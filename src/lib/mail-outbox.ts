import { randomUUID } from "node:crypto";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { DomainError } from "./errors";
import { emailConfigured, EmailDeliveryError, sendEmail, type EmailMessage } from "./mail";
import { decryptMail, encryptMail } from "./mail-crypto";

type Kind = "invoice" | "password-reset" | "email-verification";
interface Options { kind: Kind; referenceId: number; expiresAt: Date }
export type Delivery = { delivery: "accepted" | "queued" };
const messageSchema = z.object({ from: z.email(), to: z.email(), subject: z.string(), text: z.string(), html: z.string(), idempotencyKey: z.string().min(1).max(256) });
const MAX_ATTEMPTS = 6;

/** Pass a transaction client to commit the event and its message together. */
export async function enqueueEmail(message: EmailMessage, options: Options, client: Prisma.TransactionClient = db): Promise<string> {
  if (!emailConfigured()) throw new DomainError("Email delivery is not configured. Contact your administrator", 503);
  const payload = messageSchema.parse({ ...message, from: process.env.EMAIL_FROM?.trim() });
  const existing = await client.mailOutbox.findUnique({ where: { idempotencyKey: message.idempotencyKey }, select: { id: true } });
  if (existing) return existing.id;
  const job = await client.mailOutbox.upsert({
    where: { idempotencyKey: message.idempotencyKey }, update: {},
    create: { id: randomUUID(), idempotencyKey: message.idempotencyKey, payload: encryptMail(payload), ...options },
    select: { id: true },
  });
  return job.id;
}

async function currentMessage(kind: string, referenceId: number | null, message: EmailMessage) {
  if (referenceId === null) return false;
  const now = new Date();
  if (kind === "invoice") {
    return !!await db.invoice.findFirst({ where: { id: referenceId, status: { in: ["CONFIRMED", "PAID"] }, customer: { email: message.to } }, select: { id: true } });
  }
  const record = kind === "password-reset"
    ? await db.passwordReset.findUnique({ where: { id: referenceId }, include: { user: { select: { email: true } } } })
    : await db.emailVerification.findUnique({ where: { id: referenceId }, include: { user: { select: { email: true } } } });
  return !!record && !record.usedAt && record.expiresAt > now && record.user.email === message.to;
}

/** A database lease and provider idempotency protect against overlapping/restarted workers. */
export async function deliverQueuedEmail(id: string): Promise<Delivery> {
  const now = new Date();
  const job = await db.mailOutbox.findUniqueOrThrow({ where: { id } });
  if (job.status === "DELIVERED") return { delivery: "accepted" };
  if (job.status === "FAILED") throw new DomainError("Email could not be sent. Please try again later", 503);
  if (job.expiresAt <= now) {
    await db.mailOutbox.updateMany({ where: { id, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "FAILED", payload: "", leaseUntil: null, lastError: "expired" } });
    throw new DomainError("Email could not be sent. Please request a new link or notice", 503);
  }
  const leaseUntil = new Date(now.getTime() + 60_000);
  const claimed = await db.mailOutbox.updateMany({
    where: { id, expiresAt: { gt: now }, nextAttemptAt: { lte: now }, OR: [{ status: "PENDING" }, { status: "PROCESSING", leaseUntil: { lte: now } }] },
    data: { status: "PROCESSING", leaseUntil, attempts: { increment: 1 } },
  });
  if (!claimed.count) return { delivery: "queued" };
  let sent = false;
  try {
    const message = messageSchema.parse(decryptMail(job.payload));
    if (!await currentMessage(job.kind, job.referenceId, message)) throw new EmailDeliveryError(false);
    await sendEmail(message);
    sent = true;
    const committed = await db.$transaction(async (tx) => {
      // Commit acceptance and the invoice timestamp together. The payload is no longer needed.
      const owned = await tx.mailOutbox.updateMany({ where: { id, status: "PROCESSING", leaseUntil }, data: { status: "DELIVERED", payload: "", deliveredAt: new Date(), leaseUntil: null, lastError: null } });
      if (owned.count && job.kind === "invoice" && job.referenceId !== null) await tx.invoice.updateMany({ where: { id: job.referenceId }, data: { sentAt: new Date() } });
      return owned.count === 1;
    });
    return { delivery: committed ? "accepted" : "queued" };
  } catch (error) {
    unstable_rethrow(error);
    const retryable = sent || error instanceof EmailDeliveryError && error.retryable;
    const delay = Math.max(60_000 * 2 ** job.attempts, error instanceof EmailDeliveryError ? error.retryAfterMs : 0);
    const retryAt = new Date(Date.now() + Math.min(delay, 3_600_000));
    const retry = retryable && job.attempts + 1 < MAX_ATTEMPTS && retryAt < job.expiresAt;
    const owned = await db.mailOutbox.updateMany({ where: { id, status: "PROCESSING", leaseUntil }, data: { status: retry ? "PENDING" : "FAILED", nextAttemptAt: retryAt, leaseUntil: null, lastError: retry ? "temporary-delivery-failure" : "delivery-failed", ...(!retry ? { payload: "" } : {}) } });
    if (!owned.count) return { delivery: "queued" };
    if (retry) return { delivery: "queued" };
    throw new DomainError("Email could not be sent. Please try again later", 503);
  }
}

export async function queueEmail(message: EmailMessage, options: Options): Promise<Delivery> {
  return deliverQueuedEmail(await enqueueEmail(message, options));
}

/** Bounded drain; retries stop before token expiry and well within provider idempotency retention. */
export async function drainMailOutbox(limit = 20): Promise<{ processed: number }> {
  const now = new Date();
  await db.mailOutbox.updateMany({ where: { status: { in: ["PENDING", "PROCESSING"] }, expiresAt: { lte: now } }, data: { status: "FAILED", payload: "", leaseUntil: null, lastError: "expired" } });
  const jobs = await db.mailOutbox.findMany({ where: { expiresAt: { gt: now }, nextAttemptAt: { lte: now }, OR: [{ status: "PENDING" }, { status: "PROCESSING", leaseUntil: { lte: now } }] }, orderBy: { nextAttemptAt: "asc" }, take: Math.min(100, Math.max(1, limit)), select: { id: true } });
  for (const job of jobs) {
    try { await deliverQueuedEmail(job.id); } catch (error) { unstable_rethrow(error); /* Status is persisted; never log payloads. */ }
  }
  await db.mailOutbox.deleteMany({ where: { status: { in: ["DELIVERED", "FAILED"] }, createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } });
  return { processed: jobs.length };
}

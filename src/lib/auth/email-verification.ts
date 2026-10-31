import { createHash, randomBytes } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { escapeHtml } from "@/lib/mail";
import { enqueueEmail, deliverQueuedEmail } from "@/lib/mail-outbox";
import { appOrigin } from "./config";
import { recoveryMailAvailable } from "./recovery-mail";
import { AuthError, limitAuthAttempt } from "./security";
import { forgotPasswordSchema } from "./validation";

export const VERIFICATION_MINUTES = 60;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const invalid = () => new AuthError("Verification link is invalid or expired. Request a new link", 400);

export async function requestEmailVerification(input: unknown, source: string) {
  const { email } = forgotPasswordSchema.parse(input);
  await limitAuthAttempt("verify-email", email, source);
  if (!recoveryMailAvailable()) throw new AuthError("Email verification delivery is not configured", 503);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt) return {};
  const token = randomBytes(32).toString("hex");
  const url = new URL("/verify-email", appOrigin());
  // Fragments are not sent in HTTP requests or referrers, keeping tokens out of access logs.
  url.hash = new URLSearchParams({ token }).toString();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VERIFICATION_MINUTES * 60_000);
  const { record, jobId } = await db.$transaction(async (tx) => {
    await tx.emailVerification.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    const record = await tx.emailVerification.create({ data: { userId: user.id, email, tokenHash: digest(token), expiresAt } });
    const jobId = process.env.EMAIL_PROVIDER === "resend" ? await enqueueEmail({
      to: email, subject: "Verify your Brightloop email",
      text: `Verify your Brightloop email address: ${url.href}\n\nThis link expires in ${VERIFICATION_MINUTES} minutes. If you did not create an account, ignore this message.`,
      html: `<h1>Verify your Brightloop email</h1><p><a href="${escapeHtml(url.href)}">Verify email address</a></p><p>This link expires in ${VERIFICATION_MINUTES} minutes. If you did not create an account, ignore this message.</p>`,
      idempotencyKey: `email-verification/${record.id}`,
    }, { kind: "email-verification", referenceId: record.id, expiresAt }, tx) : null;
    return { record, jobId };
  });
  if (!jobId) {
    // recoveryMailAvailable already enforced the explicit local-only development preview.
    console.info(`[dev mailer] Email verification for ${email}: ${url.href}`);
    return { devVerificationUrl: url.href };
  }
  try { await deliverQueuedEmail(jobId); }
  catch (error) {
    unstable_rethrow(error);
    await db.emailVerification.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    console.error("Email verification delivery failed");
  }
  return {};
}

export async function verifyEmail(input: unknown): Promise<void> {
  const { token } = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(input);
  await db.$transaction(async (tx) => {
    const record = await tx.emailVerification.findUnique({ where: { tokenHash: digest(token) }, include: { user: { select: { email: true } } } });
    const now = new Date();
    if (!record || record.usedAt || record.expiresAt <= now || record.email !== record.user.email) throw invalid();
    const consumed = await tx.emailVerification.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (consumed.count !== 1) throw invalid();
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } });
    await tx.emailVerification.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: now } });
  });
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { runBilling } from "./billing";
import { confirmInvoice } from "./invoices";
import { resetDb, seedSubscription, utc } from "@/test/factory";
import { deliverQueuedEmail, drainMailOutbox, enqueueEmail } from "./mail-outbox";
import { decryptMail } from "./mail-crypto";

const request = vi.fn<typeof fetch>();
beforeEach(async () => {
  await resetDb();
  vi.stubEnv("EMAIL_PROVIDER", "resend"); vi.stubEnv("EMAIL_FROM", "billing@example.com"); vi.stubEnv("RESEND_API_KEY", "re_test_queue_key");
  request.mockReset().mockImplementation(async () => Response.json({ id: "accepted" }));
  vi.stubGlobal("fetch", request);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function fixture() {
  const { customer } = await seedSubscription();
  await runBilling(utc("2026-01-15"));
  const invoice = await db.invoice.findFirstOrThrow();
  await confirmInvoice(invoice.id);
  const message = { to: customer.email, subject: "Invoice test", text: "private-reset-token", html: "<p>Private content</p>", idempotencyKey: `invoice/${invoice.id}` };
  const options = { kind: "invoice" as const, referenceId: invoice.id, expiresAt: new Date(Date.now() + 60 * 60_000) };
  const id = await enqueueEmail(message, options);
  return { id, invoice, customer, message, options };
}

describe("durable encrypted outbox", () => {
  it("encrypts private payloads and erases them after provider acceptance", async () => {
    const { id, message, invoice, options } = await fixture();
    const queued = await db.mailOutbox.findUniqueOrThrow({ where: { id } });
    expect(queued.payload).not.toContain(message.to);
    expect(queued.payload).not.toContain(message.text);
    expect(decryptMail(queued.payload)).toMatchObject(message);
    expect(await deliverQueuedEmail(id)).toEqual({ delivery: "accepted" });
    expect((await db.mailOutbox.findUniqueOrThrow({ where: { id } })).payload).toBe("");
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).sentAt).not.toBeNull();
    expect(await enqueueEmail(message, options)).toBe(id);
    await deliverQueuedEmail(id);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("persists retry state, retains the original sender/payload and honors retry-after", async () => {
    const { id, invoice } = await fixture();
    request.mockImplementationOnce(async () => Response.json({}, { status: 429, headers: { "Retry-After": "120" } }));
    expect(await deliverQueuedEmail(id)).toEqual({ delivery: "queued" });
    const retry = await db.mailOutbox.findUniqueOrThrow({ where: { id } });
    expect(retry.status).toBe("PENDING"); expect(retry.attempts).toBe(1);
    expect(retry.nextAttemptAt.getTime() - Date.now()).toBeGreaterThan(115_000);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).sentAt).toBeNull();
    vi.stubEnv("EMAIL_FROM", "new-sender@example.com");
    await db.mailOutbox.update({ where: { id }, data: { nextAttemptAt: new Date(0) } });
    await drainMailOutbox();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][1]!.body).toBe(request.mock.calls[1][1]!.body);
    expect((await db.mailOutbox.findUniqueOrThrow({ where: { id } })).status).toBe("DELIVERED");
  });

  it("claims a message once when two workers race", async () => {
    const { id } = await fixture();
    await Promise.all([deliverQueuedEmail(id), deliverQueuedEmail(id)]);
    expect(request).toHaveBeenCalledTimes(1);
    expect((await db.mailOutbox.findUniqueOrThrow({ where: { id } })).status).toBe("DELIVERED");
  });

  it("recovers a worker lease left by a stopped process", async () => {
    const { id } = await fixture();
    await db.mailOutbox.update({ where: { id }, data: { status: "PROCESSING", leaseUntil: new Date(0), attempts: 1 } });
    await drainMailOutbox();
    expect((await db.mailOutbox.findUniqueOrThrow({ where: { id } })).attempts).toBe(2);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("never sends expired jobs or cancelled invoices", async () => {
    const { id, invoice, customer } = await fixture();
    await db.mailOutbox.update({ where: { id }, data: { expiresAt: new Date(0) } });
    await drainMailOutbox();
    expect((await db.mailOutbox.findUniqueOrThrow({ where: { id } })).payload).toBe("");
    const second = await enqueueEmail({ to: customer.email, subject: "test", text: "test", html: "test", idempotencyKey: "cancelled" }, { kind: "invoice", referenceId: invoice.id, expiresAt: new Date(Date.now() + 60_000) });
    await db.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED" } });
    await expect(deliverQueuedEmail(second)).rejects.toMatchObject({ status: 503 });
    expect(request).not.toHaveBeenCalled();
  });

  it("stops on permanent rejection and after the retry budget is exhausted", async () => {
    const { id } = await fixture();
    request.mockImplementation(async () => Response.json({}, { status: 503 }));
    await db.mailOutbox.update({ where: { id }, data: { attempts: 5 } });
    await expect(deliverQueuedEmail(id)).rejects.toMatchObject({ status: 503 });
    const failed = await db.mailOutbox.findUniqueOrThrow({ where: { id } });
    expect(failed.status).toBe("FAILED"); expect(failed.attempts).toBe(6); expect(failed.payload).toBe("");
    await drainMailOutbox(); expect(request).toHaveBeenCalledTimes(1);
  });

  it("fails safely if encrypted content is tampered with or its key changes", async () => {
    const { id } = await fixture();
    vi.stubEnv("AUTH_SESSION_SECRET", "a-different-32-character-secret-for-test");
    await expect(deliverQueuedEmail(id)).rejects.toMatchObject({ status: 503 });
    expect(request).not.toHaveBeenCalled();
    expect((await db.mailOutbox.findUniqueOrThrow({ where: { id } })).payload).toBe("");
  });
});

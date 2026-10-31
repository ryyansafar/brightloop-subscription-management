import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { runBilling } from "./billing";
import { confirmInvoice } from "./invoices";
import { recordPayment } from "./payments";
import { transitionSubscription } from "./subscriptions";
import { resetDb, seedSubscription, utc } from "@/test/factory";

const request = vi.fn<typeof fetch>();
beforeEach(async () => {
  await resetDb();
  vi.stubEnv("EMAIL_PROVIDER", "resend");
  vi.stubEnv("RESEND_API_KEY", "re_notification_test_key");
  vi.stubEnv("EMAIL_FROM", "billing@example.com");
  vi.stubEnv("APP_ORIGIN", "https://brightloop.example");
  request.mockReset().mockImplementation(async () => Response.json({ id: "notice" }));
  vi.stubGlobal("fetch", request);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

const sentPayload = (index = 0) => JSON.parse(request.mock.calls[index][1]!.body as string);

async function confirmedInvoice() {
  const seeded = await seedSubscription();
  await runBilling(utc("2026-01-15"));
  const invoice = await db.invoice.findFirstOrThrow();
  await confirmInvoice(invoice.id);
  return { ...seeded, invoice };
}

describe("payment received email", () => {
  it("sends a receipt with the remaining balance for a partial payment", async () => {
    const { invoice, customer } = await confirmedInvoice();
    const result = await recordPayment({ invoiceId: invoice.id, method: "UPI", amount: 100_000 });
    const payload = sentPayload();
    expect(payload.to).toEqual([customer.email]);
    expect(payload.subject).toBe(`Payment received for invoice ${invoice.number}`);
    expect(payload.text).toContain("Remaining balance");
    expect(payload.text).toContain("₹");
    expect(payload.text).not.toContain("Congratulations");
    expect(payload.text).toContain(`https://brightloop.example/portal/invoices/${invoice.id}`);
    expect(result.outstanding).toBe(invoice.total - 100_000);
  });

  it("congratulates the customer when the invoice is paid in full", async () => {
    const { invoice } = await confirmedInvoice();
    await recordPayment({ invoiceId: invoice.id, method: "UPI", amount: invoice.total });
    const payload = sentPayload();
    expect(payload.text).toContain("Congratulations, your invoice");
    expect(payload.text).toContain("paid in full");
    expect(payload.text).not.toContain("Remaining balance");
  });

  it("still records the payment when mail is disabled or the provider fails", async () => {
    const { invoice } = await confirmedInvoice();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("EMAIL_PROVIDER", "disabled");
    await recordPayment({ invoiceId: invoice.id, method: "CASH", amount: 100_000 });
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    request.mockImplementationOnce(async () => Response.json({ message: "quota" }, { status: 429 }));
    const last = await recordPayment({ invoiceId: invoice.id, method: "CASH", amount: invoice.total - 100_000 });
    expect(last.invoiceStatus).toBe("PAID");
    expect(await db.payment.count()).toBe(2);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("PAID");
    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe("subscription activated email", () => {
  async function confirmedSubscription() {
    const seeded = await seedSubscription({ status: "CONFIRMED" });
    await db.customer.update({ where: { id: seeded.customer.id }, data: { name: "<b>Ann</b>" } });
    return seeded;
  }

  it("announces activation with the portal link and escapes content", async () => {
    const { subscription, customer } = await confirmedSubscription();
    await transitionSubscription(subscription.id, "ACTIVE");
    const payload = sentPayload();
    expect(payload.to).toEqual([customer.email]);
    expect(payload.subject).toBe(`Your Brightloop subscription ${subscription.number} is active`);
    expect(payload.text).toContain("Congratulations");
    expect(payload.text).toContain("Next invoice date: 2026-01-15");
    expect(payload.text).toContain(`https://brightloop.example/portal/subscriptions/${subscription.id}`);
    expect(payload.html).toContain("&lt;b&gt;Ann&lt;/b&gt;");
    expect(payload.html).not.toContain("<b>Ann");
  });

  it("does not announce a resume from pause", async () => {
    const { subscription } = await seedSubscription();
    await transitionSubscription(subscription.id, "PAUSED");
    await transitionSubscription(subscription.id, "ACTIVE");
    expect(request).not.toHaveBeenCalled();
  });

  it("completes the transition when mail fails", async () => {
    const { subscription } = await confirmedSubscription();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("EMAIL_PROVIDER", "disabled");
    await transitionSubscription(subscription.id, "ACTIVE");
    expect((await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).status).toBe("ACTIVE");
    expect(log).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
  });
});

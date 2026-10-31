import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { runBilling } from "./billing";
import { confirmInvoice, markInvoiceSent } from "./invoices";
import { resetDb, seedSubscription, utc } from "@/test/factory";
import { POST as invoiceAction } from "@/app/api/invoices/[id]/[action]/route";

const request = vi.fn<typeof fetch>();
beforeEach(async () => {
  await resetDb();
  vi.stubEnv("EMAIL_PROVIDER", "resend");
  vi.stubEnv("RESEND_API_KEY", "re_invoice_test_key");
  vi.stubEnv("EMAIL_FROM", "billing@example.com");
  vi.stubEnv("APP_ORIGIN", "https://brightloop.example");
  request.mockReset().mockImplementation(async () => Response.json({ id: "invoice-email" }));
  vi.stubGlobal("fetch", request);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function invoiceFixture() {
  const seeded = await seedSubscription();
  await db.customer.update({ where: { id: seeded.customer.id }, data: { name: '<script>alert("x")</script>' } });
  await runBilling(utc("2026-01-15"));
  const invoice = await db.invoice.findFirstOrThrow();
  return { ...seeded, invoice };
}

describe("invoice mail integration", () => {
  it("submits confirmed invoices to their customer and escapes template content", async () => {
    const { customer, invoice } = await invoiceFixture();
    await confirmInvoice(invoice.id);
    await markInvoiceSent(invoice.id);
    const payload = JSON.parse(request.mock.calls[0][1]!.body as string);
    expect(payload.to).toEqual([customer.email]);
    expect(payload.text).toContain(invoice.number);
    expect(payload.text).toContain(`https://brightloop.example/portal/invoices/${invoice.id}`);
    expect(payload.html).toContain("&lt;script&gt;");
    expect(payload.html).not.toContain("<script>");
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).sentAt).not.toBeNull();
  });

  it("does not mark a failed provider request as sent; retry uses the same idempotency key", async () => {
    const { invoice } = await invoiceFixture();
    await confirmInvoice(invoice.id);
    request.mockImplementationOnce(async () => Response.json({ message: "quota" }, { status: 429 }));
    await expect(markInvoiceSent(invoice.id)).rejects.toThrow(/could not be sent/);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).sentAt).toBeNull();
    await markInvoiceSent(invoice.id);
    const key = (index: number) => (request.mock.calls[index][1]!.headers as Record<string, string>)["Idempotency-Key"];
    expect(key(0)).toBe(key(1));
    await markInvoiceSent(invoice.id);
    expect(key(2)).not.toBe(key(1));
  });

  it("refuses draft/cancelled invoices before contacting the provider", async () => {
    const { invoice } = await invoiceFixture();
    await expect(markInvoiceSent(invoice.id)).rejects.toThrow(/Only confirmed/);
    await db.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED" } });
    await expect(markInvoiceSent(invoice.id)).rejects.toThrow(/Only confirmed/);
    expect(request).not.toHaveBeenCalled();
  });

  it("fails clearly when mail is disabled and leaves sentAt unchanged", async () => {
    const { invoice } = await invoiceFixture();
    await confirmInvoice(invoice.id);
    vi.stubEnv("EMAIL_PROVIDER", "disabled");
    await expect(markInvoiceSent(invoice.id)).rejects.toThrow(/not configured/);
    expect(request).not.toHaveBeenCalled();
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).sentAt).toBeNull();
  });

  it("preserves API role restrictions and returns a safe 503 when delivery fails", async () => {
    const { invoice } = await invoiceFixture();
    await confirmInvoice(invoice.id);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_DEV_BYPASS", "1");
    const call = (role: string) => invoiceAction(new Request(`https://brightloop.example/api/invoices/${invoice.id}/send`, {
      method: "POST",
      headers: { Origin: "https://brightloop.example", "x-dev-role": role, "x-dev-user-id": "1" },
    }), { params: Promise.resolve({ id: String(invoice.id), action: "send" }) });
    expect((await call("CUSTOMER")).status).toBe(403);
    expect(request).not.toHaveBeenCalled();
    request.mockRejectedValueOnce(new Error("private provider response"));
    const failed = await call("STAFF");
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ ok: false, error: "Email could not be sent. Please try again later" });
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).sentAt).toBeNull();
    expect((await call("ADMIN")).status).toBe(200);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { runBilling } from "@/lib/billing";
import { cancelInvoice, confirmInvoice, generateInvoiceNow, markInvoiceSent } from "@/lib/invoices";
import { recordPayment } from "@/lib/payments";
import {
  createSubscription,
  renewSubscription,
  transitionSubscription,
} from "@/lib/subscriptions";
import { resetDb, seedDiscount, seedSubscription, utc } from "@/test/factory";

const ymd = (d: Date | null) => d?.toISOString().slice(0, 10);

beforeEach(resetDb);
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function draftInvoice() {
  const seeded = await seedSubscription();
  await runBilling(utc("2026-01-15"));
  const invoice = await db.invoice.findFirstOrThrow();
  return { ...seeded, invoice };
}

describe("createSubscription", () => {
  async function catalog() {
    const customer = await db.customer.create({ data: { name: "A", email: "a@test.dev" } });
    const plan = await db.plan.create({
      data: { name: "Yearly", price: 0, periodUnit: "YEAR", minQuantity: 2 },
    });
    const product = await db.product.create({
      data: { name: "Software", type: "SOFTWARE", salesPrice: 100_000 },
    });
    const variant = await db.variantOption.create({
      data: { productId: product.id, attribute: "Brand", value: "Odoo", extraPrice: 56_000 },
    });
    const tax = await db.taxRate.create({ data: { name: "GST", rateBps: 1800 } });
    return { customer, plan, product, variant, tax };
  }

  it("prices lines with the variant extra and the tax rate", async () => {
    const { customer, plan, product, variant, tax } = await catalog();
    const created = await createSubscription({
      customerId: customer.id,
      planId: plan.id,
      startDate: "2026-02-01",
      lines: [{ productId: product.id, variantOptionId: variant.id, quantity: 2, taxRateId: tax.id }],
    });
    expect(created.number).toBe("SUB-00001");
    const line = await db.subscriptionLine.findFirstOrThrow();
    expect(line.unitPrice).toBe(156_000);
    expect(line.taxBps).toBe(1800);
  });

  it("builds lines from a quotation template", async () => {
    const { customer, plan, product } = await catalog();
    const template = await db.quoteTemplate.create({
      data: {
        name: "Standard",
        planId: plan.id,
        lines: { create: [{ productId: product.id, quantity: 3 }] },
      },
    });
    await createSubscription({
      customerId: customer.id,
      planId: plan.id,
      templateId: template.id,
      startDate: "2026-02-01",
    });
    expect((await db.subscriptionLine.findFirstOrThrow()).quantity).toBe(3);
  });

  it("rejects invalid input with clear messages", async () => {
    const { customer, plan, product } = await catalog();
    const base = { customerId: customer.id, planId: plan.id, startDate: "2026-02-01" };
    await expect(createSubscription({ ...base, lines: [] })).rejects.toThrow(/at least one line/);
    await expect(
      createSubscription({ ...base, lines: [{ productId: product.id, quantity: 1 }] }),
    ).rejects.toThrow(/minimum quantity of 2/);
    await expect(
      createSubscription({
        ...base,
        endDate: "2026-01-01",
        lines: [{ productId: product.id, quantity: 2 }],
      }),
    ).rejects.toThrow(/End date must be after/);
  });
});

describe("transitionSubscription", () => {
  it("walks the happy path and arms billing on activation", async () => {
    const { subscription } = await seedSubscription({ status: "DRAFT" });
    await db.subscription.update({ where: { id: subscription.id }, data: { nextInvoiceDate: null } });
    for (const to of ["QUOTATION", "CONFIRMED", "ACTIVE"] as const) {
      await transitionSubscription(subscription.id, to);
    }
    const after = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(after.status).toBe("ACTIVE");
    expect(ymd(after.nextInvoiceDate)).toBe("2026-01-15");
  });

  it("rejects skipping a step", async () => {
    const { subscription } = await seedSubscription({ status: "DRAFT" });
    await expect(transitionSubscription(subscription.id, "ACTIVE")).rejects.toThrow(/Cannot move/);
  });

  it("requires a reason to close and stops billing", async () => {
    const { subscription } = await seedSubscription();
    await expect(transitionSubscription(subscription.id, "CLOSED")).rejects.toThrow(/close reason/);
    await transitionSubscription(subscription.id, "CLOSED", { closeReason: "Customer left" });
    const after = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(after.status).toBe("CLOSED");
    expect(after.nextInvoiceDate).toBeNull();
  });

  it("does not bill the paused time after resuming", async () => {
    const { subscription } = await seedSubscription();
    await transitionSubscription(subscription.id, "PAUSED", { today: utc("2026-01-20") });
    await transitionSubscription(subscription.id, "ACTIVE", { today: utc("2026-05-01") });
    const result = await runBilling(utc("2026-05-01"));
    expect(result.invoicesCreated).toBe(1);
  });

  it("refuses to pause a plan that cannot pause", async () => {
    const { subscription, plan } = await seedSubscription();
    await db.plan.update({ where: { id: plan.id }, data: { pausable: false } });
    await expect(transitionSubscription(subscription.id, "PAUSED")).rejects.toThrow(/cannot be paused/);
  });
});

describe("renewSubscription", () => {
  it("extends the end date by one period and resumes billing", async () => {
    const { subscription } = await seedSubscription({ end: "2026-03-15" });
    await runBilling(utc("2026-06-01"));
    const newEnd = await renewSubscription(subscription.id);
    expect(ymd(newEnd)).toBe("2026-04-15");
    const after = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(ymd(after.nextInvoiceDate)).toBe("2026-03-15");
  });

  it("refuses non-renewable plans", async () => {
    const { subscription, plan } = await seedSubscription({ end: "2026-03-15" });
    await db.plan.update({ where: { id: plan.id }, data: { renewable: false } });
    await expect(renewSubscription(subscription.id)).rejects.toThrow(/cannot be renewed/);
  });
});

describe("invoice actions", () => {
  it("confirms, sends and refuses to confirm twice", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test_dummy_key");
    vi.stubEnv("EMAIL_FROM", "billing@brightloop.test");
    vi.stubEnv("APP_ORIGIN", "https://brightloop.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "test-email" })));
    const { invoice } = await draftInvoice();
    await expect(markInvoiceSent(invoice.id)).rejects.toThrow(/Only confirmed/);
    await confirmInvoice(invoice.id);
    await markInvoiceSent(invoice.id);
    const after = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(after.status).toBe("CONFIRMED");
    expect(after.sentAt).not.toBeNull();
    await expect(confirmInvoice(invoice.id)).rejects.toThrow(/Cannot move/);
  });

  it("cancelling releases the discount use and blocks re-billing the period", async () => {
    const { product, subscription } = await seedSubscription();
    const discount = await seedDiscount(product.id, { usageLimit: 1 });
    await runBilling(utc("2026-01-15"));
    const invoice = await db.invoice.findFirstOrThrow();
    expect((await db.discount.findUniqueOrThrow({ where: { id: discount.id } })).usedCount).toBe(1);

    await cancelInvoice(invoice.id);
    expect((await db.discount.findUniqueOrThrow({ where: { id: discount.id } })).usedCount).toBe(0);

    await db.subscription.update({
      where: { id: subscription.id },
      data: { nextInvoiceDate: utc("2026-01-15") },
    });
    const again = await runBilling(utc("2026-01-15"));
    expect(again.invoicesCreated).toBe(0);
    expect(await db.invoice.count()).toBe(1);
  });

  it("creates the invoice a subscription is due for, exactly once", async () => {
    const { subscription } = await seedSubscription({ start: "2026-01-15" });
    const id = await generateInvoiceNow(subscription.id, utc("2026-01-20"));
    expect(id).toBeGreaterThan(0);
    // the next period (15 Feb) is in the future: a second click must not bill it
    await expect(generateInvoiceNow(subscription.id, utc("2026-01-20"))).rejects.toThrow(/not due until 2026-02-15/);
    expect(await db.invoice.count()).toBe(1);
  });

  it("refuses to bill a subscription ahead of its first date or when inactive", async () => {
    const future = await seedSubscription({ start: "2026-06-01" });
    await expect(generateInvoiceNow(future.subscription.id, utc("2026-01-01"))).rejects.toThrow(/not due until 2026-06-01/);
    const paused = await seedSubscription({ status: "PAUSED" });
    await expect(generateInvoiceNow(paused.subscription.id, utc("2026-01-20"))).rejects.toThrow(/Only active/);
    expect(await db.invoice.count()).toBe(0);
  });
});

describe("recordPayment", () => {
  it("rejects payments on unconfirmed invoices", async () => {
    const { invoice } = await draftInvoice();
    await expect(
      recordPayment({ invoiceId: invoice.id, method: "CASH", amount: 100 }),
    ).rejects.toThrow(/confirmed invoices/);
  });

  it("settles an invoice in two payments and rejects overpayment", async () => {
    const { invoice } = await draftInvoice();
    await confirmInvoice(invoice.id);

    const first = await recordPayment({ invoiceId: invoice.id, method: "UPI", amount: 100_000 });
    expect(first.invoiceStatus).toBe("CONFIRMED");
    expect(first.outstanding).toBe(invoice.total - 100_000);

    await expect(
      recordPayment({ invoiceId: invoice.id, method: "UPI", amount: invoice.total }),
    ).rejects.toThrow(/exceeds the outstanding/);

    const second = await recordPayment({
      invoiceId: invoice.id,
      method: "BANK_TRANSFER",
      amount: invoice.total - 100_000,
      note: "Final",
    });
    expect(second.invoiceStatus).toBe("PAID");
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("PAID");
  });

  it("validates amount and method", async () => {
    const { invoice } = await draftInvoice();
    await confirmInvoice(invoice.id);
    await expect(
      recordPayment({ invoiceId: invoice.id, method: "CASH", amount: 0 }),
    ).rejects.toThrow();
    await expect(
      // @ts-expect-error invalid method on purpose
      recordPayment({ invoiceId: invoice.id, method: "BITCOIN", amount: 100 }),
    ).rejects.toThrow();
  });
});

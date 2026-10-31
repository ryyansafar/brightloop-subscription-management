import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { billSubscription, runBilling } from "@/lib/billing";
import { resetDb, seedDiscount, seedSubscription, utc } from "@/test/factory";

const ymd = (d: Date | null) => d?.toISOString().slice(0, 10);

beforeEach(resetDb);

describe("runBilling", () => {
  it("invoices a due subscription and advances the next invoice date", async () => {
    const { subscription } = await seedSubscription();
    const result = await runBilling(utc("2026-01-15"));

    expect(result.invoicesCreated).toBe(1);
    const invoice = await db.invoice.findFirstOrThrow({
      where: { subscriptionId: subscription.id },
      include: { lines: true },
    });
    expect(invoice.status).toBe("DRAFT");
    expect(invoice.subtotal).toBe(200_000);
    expect(invoice.taxTotal).toBe(36_000);
    expect(invoice.total).toBe(236_000);
    expect(ymd(invoice.dueDate)).toBe("2026-01-30");
    expect(invoice.lines).toHaveLength(1);

    const after = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(ymd(after.nextInvoiceDate)).toBe("2026-02-15");
  });

  it("never bills a period twice when run repeatedly", async () => {
    await seedSubscription();
    await runBilling(utc("2026-01-20"));
    const again = await runBilling(utc("2026-01-20"));
    expect(again.due).toBe(0);
    expect(await db.invoice.count()).toBe(1);
  });

  it("catches up every missed period one at a time", async () => {
    const { subscription } = await seedSubscription();
    const result = await runBilling(utc("2026-04-20"));
    expect(result.invoicesCreated).toBe(4); // Jan, Feb, Mar, Apr
    const starts = (
      await db.invoice.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { periodStart: "asc" },
      })
    ).map((i) => ymd(i.periodStart));
    expect(starts).toEqual(["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15"]);
  });

  it("ignores subscriptions that are not due or not active", async () => {
    await seedSubscription({ start: "2026-06-01" });
    await seedSubscription({ status: "PAUSED" });
    await seedSubscription({ status: "DRAFT" });
    const result = await runBilling(utc("2026-01-20"));
    expect(result.due).toBe(0);
    expect(await db.invoice.count()).toBe(0);
  });

  it("skips a period that already has an invoice and still advances", async () => {
    const { subscription } = await seedSubscription();
    await db.invoice.create({
      data: {
        number: "MANUAL-1",
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        periodStart: utc("2026-01-15"),
        periodEnd: utc("2026-02-15"),
        dueDate: utc("2026-01-30"),
      },
    });
    const result = await runBilling(utc("2026-01-20"));
    expect(result.periodsSkipped).toBe(1);
    expect(result.invoicesCreated).toBe(0);
    expect(await db.invoice.count()).toBe(1);
    const after = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(ymd(after.nextInvoiceDate)).toBe("2026-02-15");
  });

  it("closes an auto-close plan after the final period", async () => {
    const { subscription } = await seedSubscription({ autoClose: true, end: "2026-03-15" });
    const result = await runBilling(utc("2026-06-01"));
    expect(result.invoicesCreated).toBe(2); // Jan and Feb periods end at the Mar 15 end date
    expect(result.subscriptionsClosed).toBe(1);
    const after = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(after.status).toBe("CLOSED");
    expect(after.nextInvoiceDate).toBeNull();
    expect(after.closeReason).toBe("Plan ended");
  });

  it("stops billing but stays active when the plan does not auto-close", async () => {
    const { subscription } = await seedSubscription({ autoClose: false, end: "2026-03-15" });
    await runBilling(utc("2026-06-01"));
    const after = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(after.status).toBe("ACTIVE");
    expect(after.nextInvoiceDate).toBeNull();
  });

  it("keeps the anchor day across short months", async () => {
    const { subscription } = await seedSubscription({ start: "2026-01-31" });
    await runBilling(utc("2026-03-31"));
    const starts = (
      await db.invoice.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { periodStart: "asc" },
      })
    ).map((i) => ymd(i.periodStart));
    expect(starts).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
});

describe("discounts during billing", () => {
  it("applies a matching discount and counts the use", async () => {
    const { product } = await seedSubscription();
    const discount = await seedDiscount(product.id);
    await runBilling(utc("2026-01-15"));
    const invoice = await db.invoice.findFirstOrThrow({ include: { lines: true } });
    expect(invoice.discountTotal).toBe(20_000);
    expect(invoice.lines[0].discountId).toBe(discount.id);
    expect(invoice.total).toBe(212_400);
    expect((await db.discount.findUniqueOrThrow({ where: { id: discount.id } })).usedCount).toBe(1);
  });

  it("stops applying a discount once its usage limit is used up", async () => {
    const { product, subscription } = await seedSubscription();
    await seedDiscount(product.id, { usageLimit: 1 });
    await runBilling(utc("2026-03-20")); // Jan, Feb, Mar
    const invoices = await db.invoice.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { periodStart: "asc" },
    });
    expect(invoices.map((i) => i.discountTotal)).toEqual([20_000, 0, 0]);
  });

  it("does not apply an expired or not-yet-started discount", async () => {
    const { product } = await seedSubscription();
    await seedDiscount(product.id, { endsAt: utc("2025-12-31") });
    await seedDiscount(product.id, { startsAt: utc("2027-01-01") });
    await runBilling(utc("2026-01-15"));
    const invoice = await db.invoice.findFirstOrThrow();
    expect(invoice.discountTotal).toBe(0);
  });

  it("applies a subscription-level discount", async () => {
    const { product } = await seedSubscription({ taxBps: 0 });
    const discount = await seedDiscount(product.id, { scope: "SUBSCRIPTION", value: 500 });
    await runBilling(utc("2026-01-15"));
    const invoice = await db.invoice.findFirstOrThrow();
    expect(invoice.discountId).toBe(discount.id);
    expect(invoice.discountTotal).toBe(10_000);
    expect(invoice.total).toBe(190_000);
  });
});

describe("billSubscription force", () => {
  it("bills the next period once even if it is not due yet", async () => {
    const { subscription } = await seedSubscription({ start: "2026-06-01" });
    const outcome = await db.$transaction((tx) =>
      billSubscription(tx, subscription.id, { today: utc("2026-01-01"), force: true }),
    );
    expect(outcome.invoiceIds).toHaveLength(1);
    const after = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(ymd(after.nextInvoiceDate)).toBe("2026-07-01");
  });

  it("refuses inactive subscriptions", async () => {
    const { subscription } = await seedSubscription({ status: "PAUSED" });
    await expect(
      db.$transaction((tx) => billSubscription(tx, subscription.id, { today: utc("2026-01-20") })),
    ).rejects.toThrow(/active/i);
  });
});

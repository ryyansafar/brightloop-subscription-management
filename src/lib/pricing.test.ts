import { describe, expect, it } from "vitest";
import { priceInvoice, type DiscountRule, type PricingLine } from "./pricing";

const line = (over: Partial<PricingLine> = {}): PricingLine => ({
  description: "Seat",
  productId: 1,
  quantity: 2,
  unitPrice: 100_000,
  taxBps: 1800,
  ...over,
});

const rule = (over: Partial<DiscountRule> = {}): DiscountRule => ({
  id: 1,
  kind: "PERCENT",
  value: 1000,
  minAmount: 0,
  minQuantity: 0,
  scope: "PRODUCT",
  productId: 1,
  ...over,
});

describe("priceInvoice", () => {
  it("applies tax with no discounts", () => {
    const r = priceInvoice([line()], []);
    expect(r.subtotal).toBe(200_000);
    expect(r.taxTotal).toBe(36_000);
    expect(r.total).toBe(236_000);
  });

  it("applies a percent product discount before tax", () => {
    const r = priceInvoice([line()], [rule()]);
    expect(r.lines[0].discountAmount).toBe(20_000);
    expect(r.lines[0].discountId).toBe(1);
    expect(r.taxTotal).toBe(32_400);
    expect(r.total).toBe(212_400);
  });

  it("caps a fixed discount at the line amount", () => {
    const r = priceInvoice([line({ quantity: 1, unitPrice: 5_000 })], [
      rule({ kind: "FIXED", value: 9_999 }),
    ]);
    expect(r.lines[0].net).toBe(0);
    expect(r.total).toBe(0);
  });

  it("picks only the single best eligible product rule", () => {
    const r = priceInvoice([line()], [
      rule({ id: 1, value: 500 }),
      rule({ id: 2, value: 2000 }),
    ]);
    expect(r.lines[0].discountId).toBe(2);
    expect(r.lines[0].discountAmount).toBe(40_000);
  });

  it("respects minimum quantity and minimum amount", () => {
    const small = priceInvoice([line({ quantity: 1 })], [rule({ minQuantity: 2 })]);
    expect(small.discountTotal).toBe(0);
    const cheap = priceInvoice([line()], [rule({ minAmount: 500_000 })]);
    expect(cheap.discountTotal).toBe(0);
  });

  it("ignores a product rule for a different product", () => {
    const r = priceInvoice([line()], [rule({ productId: 99 })]);
    expect(r.discountTotal).toBe(0);
  });

  it("spreads a subscription discount across lines with no lost paise", () => {
    const lines = [
      line({ productId: 1, quantity: 1, unitPrice: 10_000, taxBps: 0 }),
      line({ productId: 2, quantity: 1, unitPrice: 10_001, taxBps: 0 }),
      line({ productId: 3, quantity: 1, unitPrice: 10_002, taxBps: 0 }),
    ];
    const r = priceInvoice(lines, [
      rule({ id: 7, scope: "SUBSCRIPTION", productId: null, kind: "FIXED", value: 1_000 }),
    ]);
    expect(r.subscriptionDiscountId).toBe(7);
    expect(r.discountTotal).toBe(1_000);
    expect(r.lines.reduce((a, l) => a + l.discountAmount, 0)).toBe(1_000);
    expect(r.total).toBe(10_000 + 10_001 + 10_002 - 1_000);
  });

  it("stacks a product discount and a subscription discount", () => {
    const r = priceInvoice([line({ taxBps: 0 })], [
      rule({ id: 1 }),
      rule({ id: 2, scope: "SUBSCRIPTION", productId: null, value: 500 }),
    ]);
    // 200000 - 10% = 180000; then 5% of 180000 = 9000
    expect(r.discountTotal).toBe(29_000);
    expect(r.total).toBe(171_000);
  });
});

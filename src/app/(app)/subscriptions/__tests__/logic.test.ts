import { describe, expect, it } from "vitest";
import {
  availableActions,
  lineAmounts,
  monthlyEquivalent,
  orderTotals,
  parseServerError,
  periodAmount,
  sumMrr,
  unitPriceFor,
  validateDraft,
  type DraftValues,
} from "../logic";

const base: DraftValues = {
  customerId: 1,
  planId: 1,
  startDate: "2026-11-01",
  endDate: "",
  paymentTermDays: "15",
  lines: [{ productId: 1, quantity: 2 }],
};
const plan = { minQuantity: 1, availableFrom: null, availableTo: null };

describe("pricing", () => {
  it("adds the variant extra to the product price", () => {
    expect(unitPriceFor(240_000, 56_000)).toBe(296_000);
    expect(unitPriceFor(240_000)).toBe(240_000);
  });

  it("rounds tax per line like billing and totals reconcile", () => {
    const lines = [
      { productId: 1, quantity: 3, unitPrice: 3333, taxBps: 1800 },
      { productId: 2, quantity: 1, unitPrice: 1001, taxBps: 500 },
    ];
    expect(lineAmounts(lines[0])).toEqual({ gross: 9999, tax: 1800, total: 11799 });
    const totals = orderTotals(lines);
    expect(totals.subtotal).toBe(11000);
    expect(totals.taxTotal).toBe(1800 + 50);
    expect(totals.total).toBe(totals.subtotal - totals.discountTotal + totals.taxTotal);
    expect(periodAmount(lines)).toBe(totals.total);
  });

  it("applies discount rules before tax, as billing does", () => {
    const totals = orderTotals(
      [{ productId: 1, quantity: 1, unitPrice: 100_000, taxBps: 1800 }],
      [{ id: 1, kind: "PERCENT", value: 1000, minAmount: 0, minQuantity: 0, scope: "SUBSCRIPTION", productId: null }],
    );
    expect(totals.discountTotal).toBe(10_000);
    expect(totals.taxTotal).toBe(16_200);
    expect(totals.total).toBe(106_200);
  });
});

describe("monthly equivalent", () => {
  it("normalises every period unit", () => {
    expect(monthlyEquivalent(120_000, "MONTH", 1)).toBe(120_000);
    expect(monthlyEquivalent(300_000, "MONTH", 3)).toBe(100_000);
    expect(monthlyEquivalent(1_200_000, "YEAR", 1)).toBe(100_000);
    expect(monthlyEquivalent(1200, "WEEK", 1)).toBe(5200);
    expect(monthlyEquivalent(1200, "DAY", 1)).toBe(36_500);
  });

  it("sums groups", () => {
    expect(
      sumMrr([
        { periodUnit: "MONTH", periodCount: 1, amount: 100 },
        { periodUnit: "YEAR", periodCount: 1, amount: 1200 },
      ]),
    ).toBe(200);
  });
});

describe("validateDraft", () => {
  it("accepts a valid draft", () => {
    expect(validateDraft(base, plan)).toEqual({});
  });

  it("requires customer, plan and lines", () => {
    const errors = validateDraft({ ...base, customerId: null, planId: null, lines: [] }, null);
    expect(errors.customerId).toBeDefined();
    expect(errors.planId).toBeDefined();
    expect(errors.lines).toBe("Add at least one line");
  });

  it("requires expiry after start", () => {
    expect(validateDraft({ ...base, endDate: "2026-11-01" }, plan).endDate).toMatch(/after/);
    expect(validateDraft({ ...base, endDate: "2026-11-02" }, plan).endDate).toBeUndefined();
  });

  it("checks plan window and minimum quantity", () => {
    const windowed = { minQuantity: 5, availableFrom: "2026-12-01T00:00:00.000Z", availableTo: null };
    const errors = validateDraft(base, windowed);
    expect(errors.startDate).toMatch(/available from/);
    expect(errors.lines).toMatch(/minimum quantity of 5/);
    const late = { minQuantity: 1, availableFrom: null, availableTo: "2026-10-01T00:00:00.000Z" };
    expect(validateDraft(base, late).startDate).toMatch(/until/);
  });

  it("validates payment terms and quantities", () => {
    expect(validateDraft({ ...base, paymentTermDays: "400" }, plan).paymentTermDays).toBeDefined();
    expect(validateDraft({ ...base, paymentTermDays: "" }, plan).paymentTermDays).toBeDefined();
    expect(validateDraft({ ...base, lines: [{ productId: 1, quantity: 0 }] }, plan).lines).toMatch(/Quantity/);
    expect(validateDraft({ ...base, lines: [{ productId: null, quantity: 1 }] }, plan).lines).toMatch(/product/);
  });
});

describe("availableActions", () => {
  const all = { pausable: true, closable: true, renewable: true, hasEndDate: true };
  const ids = (status: string, flags = all) => availableActions(status, flags).map((a) => a.id);

  it("offers one primary action per state", () => {
    expect(ids("DRAFT")).toEqual(["quote"]);
    expect(ids("QUOTATION")).toEqual(["confirm"]);
    expect(ids("CONFIRMED")).toEqual(["activate"]);
    expect(ids("PAUSED")).toEqual(["resume", "close"]);
    expect(ids("CLOSED")).toEqual([]);
    for (const s of ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "PAUSED"]) {
      expect(availableActions(s, all).filter((a) => a.primary)).toHaveLength(1);
    }
  });

  it("hides actions the plan or record cannot take", () => {
    expect(ids("ACTIVE")).toEqual(["invoice", "pause", "renew", "close"]);
    expect(ids("ACTIVE", { ...all, hasEndDate: false })).not.toContain("renew");
    expect(ids("ACTIVE", { ...all, pausable: false, closable: false, renewable: false })).toEqual(["invoice"]);
  });
});

describe("parseServerError", () => {
  it("maps zod field messages", () => {
    const { fields, general } = parseServerError("endDate: End date must be after the start date");
    expect(fields.endDate).toBe("End date must be after the start date");
    expect(general).toBeNull();
  });

  it("maps domain messages to fields and keeps the rest general", () => {
    expect(parseServerError("This plan requires a minimum quantity of 5").fields.lines).toMatch(/minimum/);
    expect(parseServerError("Plan is not available yet on that start date").fields.startDate).toBeDefined();
    expect(parseServerError("Something went wrong")).toEqual({ fields: {}, general: "Something went wrong" });
  });
});

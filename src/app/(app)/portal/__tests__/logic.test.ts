import { describe, expect, it } from "vitest";
import {
  closeBlockedReason,
  invoiceDisplayStatus,
  isPortalFilter,
  periodLabel,
  recurringAmount,
  renewBlockedReason,
  summariseOverdue,
} from "../logic";

const plan = { renewable: true, closable: true };
const active = { status: "ACTIVE", endDate: new Date("2027-01-01"), plan };

describe("renewBlockedReason", () => {
  it("allows an active, renewable subscription with an end date", () => {
    expect(renewBlockedReason(active)).toBeNull();
  });
  it("explains every refusal", () => {
    expect(renewBlockedReason({ ...active, status: "PAUSED" })).toMatch(/paused/i);
    expect(renewBlockedReason({ ...active, status: "CLOSED" })).toMatch(/active/i);
    expect(renewBlockedReason({ ...active, plan: { ...plan, renewable: false } })).toMatch(/plan/i);
    expect(renewBlockedReason({ ...active, endDate: null })).toMatch(/end date/i);
  });
});

describe("closeBlockedReason", () => {
  it("allows active and paused subscriptions", () => {
    expect(closeBlockedReason(active)).toBeNull();
    expect(closeBlockedReason({ ...active, status: "PAUSED" })).toBeNull();
  });
  it("refuses closed, quotation and non-closable plans", () => {
    expect(closeBlockedReason({ ...active, status: "CLOSED" })).toMatch(/already closed/i);
    expect(closeBlockedReason({ ...active, status: "QUOTATION" })).toMatch(/active or paused/i);
    expect(closeBlockedReason({ ...active, plan: { ...plan, closable: false } })).toMatch(/plan/i);
  });
});

describe("recurringAmount", () => {
  it("sums quantity x price plus tax per line", () => {
    const lines = [
      { productId: 1, quantity: 2, unitPrice: 100_000, taxBps: 1800 },
      { productId: 2, quantity: 1, unitPrice: 50_000, taxBps: 0 },
    ];
    expect(recurringAmount(lines)).toBe(236_000 + 50_000);
  });
});

describe("summariseOverdue", () => {
  it("counts, totals and finds the oldest", () => {
    const result = summariseOverdue([
      { number: "B", dueDate: new Date("2026-10-10"), balance: 500 },
      { number: "A", dueDate: new Date("2026-09-01"), balance: 700 },
    ]);
    expect(result).toMatchObject({ count: 2, total: 1200, oldest: { number: "A" } });
  });
  it("handles none", () => {
    expect(summariseOverdue([])).toEqual({ count: 0, total: 0, oldest: null });
  });
});

describe("labels and filters", () => {
  it("labels periods", () => {
    expect(periodLabel("MONTH", 1)).toBe("per month");
    expect(periodLabel("MONTH", 3)).toBe("every 3 months");
  });
  it("classifies invoices", () => {
    const today = new Date("2026-10-31");
    expect(invoiceDisplayStatus({ status: "CONFIRMED", dueDate: new Date("2026-10-01") }, today)).toBe("OVERDUE");
    expect(invoiceDisplayStatus({ status: "CONFIRMED", dueDate: new Date("2026-11-15") }, today)).toBe("OUTSTANDING");
    expect(invoiceDisplayStatus({ status: "PAID", dueDate: new Date("2026-10-01") }, today)).toBe("PAID");
  });
  it("accepts only known filters", () => {
    expect(isPortalFilter("overdue")).toBe(true);
    expect(isPortalFilter("draft")).toBe(false);
    expect(isPortalFilter(undefined)).toBe(false);
  });
});

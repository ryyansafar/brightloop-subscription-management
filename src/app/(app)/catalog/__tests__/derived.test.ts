import { describe, expect, it } from "vitest";
import { billingPeriodLabel, discountStatus, planFlagSummary } from "../derived";

const now = new Date("2026-10-31T00:00:00Z");
const base = {
  active: true,
  startsAt: new Date("2026-01-01T00:00:00Z"),
  endsAt: new Date("2026-12-31T00:00:00Z"),
  usedCount: 0,
  usageLimit: null as number | null,
};

describe("discountStatus", () => {
  it("is Active inside the window", () => {
    expect(discountStatus(base, now).label).toBe("Active");
  });
  it("is Expired after endsAt", () => {
    expect(discountStatus({ ...base, endsAt: new Date("2026-06-30T00:00:00Z") }, now)).toEqual({
      label: "Expired",
      tone: "danger",
    });
  });
  it("is Upcoming before startsAt", () => {
    expect(discountStatus({ ...base, startsAt: new Date("2026-11-15T00:00:00Z") }, now).label).toBe("Upcoming");
  });
  it("is Exhausted once usage reaches the limit", () => {
    expect(discountStatus({ ...base, usageLimit: 5, usedCount: 5 }, now).label).toBe("Exhausted");
    expect(discountStatus({ ...base, usageLimit: 5, usedCount: 4 }, now).label).toBe("Active");
  });
  it("is Inactive when switched off, whatever the dates", () => {
    expect(discountStatus({ ...base, active: false }, now).label).toBe("Inactive");
    expect(discountStatus({ ...base, active: false, endsAt: new Date("2025-01-01T00:00:00Z") }, now).label).toBe(
      "Inactive",
    );
  });
});

describe("billingPeriodLabel", () => {
  it("pluralises correctly", () => {
    expect(billingPeriodLabel(1, "MONTH")).toBe("Every month");
    expect(billingPeriodLabel(3, "MONTH")).toBe("Every 3 months");
    expect(billingPeriodLabel(1, "WEEK")).toBe("Every week");
    expect(billingPeriodLabel(1, "DAY")).toBe("Every day");
    expect(billingPeriodLabel(1, "YEAR")).toBe("Every year");
    expect(billingPeriodLabel(2, "YEAR")).toBe("Every 2 years");
  });
});

describe("planFlagSummary", () => {
  it("collapses several flags into one short label with a full tooltip", () => {
    const s = planFlagSummary({ renewable: true, pausable: true, closable: false, autoClose: true });
    expect(s.text).toBe("Renewable +2");
    expect(s.full).toBe("Renewable, Pausable, Auto-close");
  });
  it("handles none and one", () => {
    expect(planFlagSummary({ renewable: false, pausable: false, closable: false, autoClose: false }).text).toBe("None");
    expect(planFlagSummary({ renewable: false, pausable: true, closable: false, autoClose: false }).text).toBe(
      "Pausable",
    );
  });
});

import { describe, expect, it } from "vitest";
import { paymentMethodLabel } from "./methods";
import { readDateRange } from "./filters";

describe("paymentMethodLabel", () => {
  it("humanises each method correctly", () => {
    expect(paymentMethodLabel("UPI")).toBe("UPI");
    expect(paymentMethodLabel("BANK_TRANSFER")).toBe("Bank transfer");
    expect(paymentMethodLabel("CARD")).toBe("Card");
    expect(paymentMethodLabel("CASH")).toBe("Cash");
    expect(paymentMethodLabel("OTHER")).toBe("Other");
    expect(paymentMethodLabel("WIRE_TRANSFER")).toBe("Wire transfer");
  });
});

describe("readDateRange", () => {
  it("makes the end date inclusive", () => {
    const r = readDateRange({ from: "2026-10-01", to: "2026-10-31" });
    expect(r.from?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(r.toExclusive?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(r.reversed).toBe(false);
  });
  it("ignores malformed dates", () => {
    const r = readDateRange({ from: "yesterday", to: "2026-02-31" });
    expect(r.from).toBeUndefined();
    expect(r.toExclusive).toBeUndefined();
  });
  it("flags a reversed range and applies no filter", () => {
    const r = readDateRange({ from: "2026-10-31", to: "2026-10-01" });
    expect(r.reversed).toBe(true);
    expect(r.from).toBeUndefined();
    expect(r.toExclusive).toBeUndefined();
  });
  it("supports open-ended ranges", () => {
    expect(readDateRange({ from: "2026-10-01" }).toExclusive).toBeUndefined();
    expect(readDateRange({}).from).toBeUndefined();
  });
});

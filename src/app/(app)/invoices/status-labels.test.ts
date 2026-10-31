import { describe, expect, it } from "vitest";
import { invoiceStepLabels } from "./status-labels";

describe("invoiceStepLabels", () => {
  it("calls a confirmed invoice Confirmed, never Posted", () => {
    expect(invoiceStepLabels("CONFIRMED").CONFIRMED).toBe("Confirmed");
  });

  it("shows Overdue when the confirmed invoice is past due", () => {
    expect(invoiceStepLabels("OVERDUE").CONFIRMED).toBe("Overdue");
  });
});

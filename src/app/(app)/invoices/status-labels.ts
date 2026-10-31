/** Status-bar labels for an invoice. A confirmed invoice past its due date reads "Overdue"; otherwise "Confirmed". */
export function invoiceStepLabels(shownStatus: string): Partial<Record<string, string>> {
  return { CONFIRMED: shownStatus === "OVERDUE" ? "Overdue" : "Confirmed" };
}

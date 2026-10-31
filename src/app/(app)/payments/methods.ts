import type { PAYMENT_METHODS } from "@/lib/state";

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const LABELS: Record<PaymentMethod, string> = {
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  CASH: "Cash",
  OTHER: "Other",
};

/** "BANK_TRANSFER" -> "Bank transfer", "UPI" -> "UPI". Unknown values are humanised rather than hidden. */
export function paymentMethodLabel(method: string): string {
  const known = LABELS[method as PaymentMethod];
  if (known) return known;
  const text = method.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

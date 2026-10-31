export const ROLES = ["ADMIN", "STAFF", "CUSTOMER"] as const;
export type Role = (typeof ROLES)[number];

export const PERIOD_UNITS = ["DAY", "WEEK", "MONTH", "YEAR"] as const;
export type PeriodUnit = (typeof PERIOD_UNITS)[number];

export const SUBSCRIPTION_STATUSES = [
  "DRAFT",
  "QUOTATION",
  "CONFIRMED",
  "ACTIVE",
  "PAUSED",
  "CLOSED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const INVOICE_STATUSES = ["DRAFT", "CONFIRMED", "PAID", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const DISCOUNT_KINDS = ["FIXED", "PERCENT"] as const;
export const DISCOUNT_SCOPES = ["PRODUCT", "SUBSCRIPTION"] as const;
export const PAYMENT_METHODS = ["CARD", "BANK_TRANSFER", "UPI", "CASH", "OTHER"] as const;

const SUBSCRIPTION_FLOW: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  DRAFT: ["QUOTATION"],
  QUOTATION: ["CONFIRMED", "DRAFT"],
  CONFIRMED: ["ACTIVE"],
  ACTIVE: ["PAUSED", "CLOSED"],
  PAUSED: ["ACTIVE", "CLOSED"],
  CLOSED: [],
};

const INVOICE_FLOW: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export function canMoveSubscription(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return SUBSCRIPTION_FLOW[from].includes(to);
}

export function canMoveInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_FLOW[from].includes(to);
}

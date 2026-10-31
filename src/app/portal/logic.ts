// Pure rules for the customer portal: what a customer may do, and how invoices are classified.
import { priceInvoice } from "@/lib/pricing";

export const PORTAL_FILTERS = ["outstanding", "overdue", "paid"] as const;
export type PortalFilter = (typeof PORTAL_FILTERS)[number];

export function isPortalFilter(value: string | undefined): value is PortalFilter {
  return (PORTAL_FILTERS as readonly string[]).includes(value ?? "");
}

export interface ActionSubject {
  status: string;
  endDate: Date | null;
  plan: { renewable: boolean; closable: boolean };
}

/** Why Renew is unavailable, or null when the customer can renew. Mirrors renewSubscription(). */
export function renewBlockedReason(sub: ActionSubject): string | null {
  if (sub.status === "PAUSED") return "Paused subscriptions cannot be renewed.";
  if (sub.status !== "ACTIVE") return "Only active subscriptions can be renewed.";
  if (!sub.plan.renewable) return "This plan cannot be renewed.";
  if (!sub.endDate) return "This subscription has no end date, so there is nothing to renew.";
  return null;
}

/** Why Close is unavailable, or null. Mirrors the CLOSED transition rules. */
export function closeBlockedReason(sub: ActionSubject): string | null {
  if (sub.status === "CLOSED") return "This subscription is already closed.";
  if (sub.status !== "ACTIVE" && sub.status !== "PAUSED") return "Only active or paused subscriptions can be closed.";
  if (!sub.plan.closable) return "This plan cannot be closed early.";
  return null;
}

/** Recurring amount per period in paise: line totals plus tax, before any discounts. */
export function recurringAmount(lines: { productId: number; quantity: number; unitPrice: number; taxBps: number }[]) {
  return priceInvoice(
    lines.map((l) => ({ ...l, description: "" })),
    [],
  ).total;
}

export interface OverdueInvoice {
  number: string;
  dueDate: Date;
  balance: number;
}

/** Count, total owed and the oldest invoice, for the overdue alert. */
export function summariseOverdue(invoices: readonly OverdueInvoice[]) {
  const oldest = [...invoices].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null;
  return { count: invoices.length, total: invoices.reduce((sum, i) => sum + i.balance, 0), oldest };
}

/** "per month", "every 3 months". */
export function periodLabel(unit: string, count: number): string {
  const noun = unit.toLowerCase();
  return count === 1 ? `per ${noun}` : `every ${count} ${noun}s`;
}

/** A confirmed invoice is Overdue past its due date, otherwise Outstanding. */
export function invoiceDisplayStatus(invoice: { status: string; dueDate: Date }, today: Date): string {
  if (invoice.status !== "CONFIRMED") return invoice.status;
  return invoice.dueDate < today ? "OVERDUE" : "OUTSTANDING";
}

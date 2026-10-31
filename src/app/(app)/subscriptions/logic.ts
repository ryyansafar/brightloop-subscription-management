// Pure helpers for the subscription screens: pricing, MRR, form validation, server error mapping.
import { percentOf } from "@/lib/money";
import { priceInvoice, type DiscountRule, type PricedInvoice } from "@/lib/pricing";
import type { PeriodUnit } from "@/lib/state";

export interface PriceableLine {
  productId: number;
  quantity: number;
  /** product price plus variant extra, in paise */
  unitPrice: number;
  taxBps: number;
}

/** Unit price as the server stores it on a subscription line. */
export function unitPriceFor(salesPrice: number, variantExtra = 0): number {
  return salesPrice + variantExtra;
}

/** One line before discounts: gross, tax (rounded per line, like billing) and total. */
export function lineAmounts(line: Pick<PriceableLine, "quantity" | "unitPrice" | "taxBps">) {
  const gross = Math.max(0, line.quantity) * line.unitPrice;
  const tax = percentOf(gross, line.taxBps);
  return { gross, tax, total: gross + tax };
}

/**
 * Totals exactly as billing computes an invoice (it calls the same priceInvoice).
 * Pass the discount rules valid on the invoice date, or none for list price.
 */
export function orderTotals(lines: readonly PriceableLine[], rules: readonly DiscountRule[] = []): PricedInvoice {
  return priceInvoice(
    lines.map((l) => ({ ...l, description: "" })),
    [...rules],
  );
}

/** Recurring amount of one subscription per billing period, tax included, before discounts. */
export function periodAmount(lines: readonly PriceableLine[]): number {
  return lines.reduce((sum, l) => sum + lineAmounts(l).total, 0);
}

/** Per-period amount converted to a monthly figure (365-day year, 52-week year). */
export function monthlyEquivalent(amount: number, unit: PeriodUnit, count: number): number {
  const periods = Math.max(1, count);
  switch (unit) {
    case "DAY":
      return Math.round((amount * 365) / 12 / periods);
    case "WEEK":
      return Math.round((amount * 52) / 12 / periods);
    case "MONTH":
      return Math.round(amount / periods);
    case "YEAR":
      return Math.round(amount / (12 * periods));
  }
}

export interface MrrGroup {
  periodUnit: string;
  periodCount: number;
  /** summed per-period amounts of the active subscriptions on such plans */
  amount: number;
}

export function sumMrr(groups: readonly MrrGroup[]): number {
  return groups.reduce((sum, g) => sum + monthlyEquivalent(g.amount, g.periodUnit as PeriodUnit, g.periodCount), 0);
}

// ---- create form validation (mirrors createSubscriptionSchema + createSubscription) ----

export interface DraftLine {
  productId: number | null;
  quantity: number;
}

export interface DraftValues {
  customerId: number | null;
  planId: number | null;
  startDate: string;
  endDate: string;
  paymentTermDays: string;
  lines: readonly DraftLine[];
}

export interface PlanRules {
  minQuantity: number;
  /** ISO date or null */
  availableFrom: string | null;
  availableTo: string | null;
}

export type FormErrors = Partial<
  Record<"customerId" | "planId" | "startDate" | "endDate" | "paymentTermDays" | "lines", string>
>;

const ymd = (iso: string) => iso.slice(0, 10);

export function validateDraft(values: DraftValues, plan: PlanRules | null): FormErrors {
  const errors: FormErrors = {};
  if (!values.customerId) errors.customerId = "Choose a customer";
  if (!values.planId) errors.planId = "Choose a plan";

  const start = values.startDate ? new Date(values.startDate) : null;
  if (!start || Number.isNaN(start.getTime())) errors.startDate = "Enter a start date";

  if (values.endDate) {
    const end = new Date(values.endDate);
    if (Number.isNaN(end.getTime())) errors.endDate = "Enter a valid expiry date";
    else if (start && !errors.startDate && end <= start) errors.endDate = "Expiry must be after the start date";
  }

  if (plan && start && !errors.startDate) {
    if (plan.availableFrom && start < new Date(plan.availableFrom)) {
      errors.startDate = `This plan is available from ${ymd(plan.availableFrom)}`;
    } else if (plan.availableTo && start > new Date(plan.availableTo)) {
      errors.startDate = `This plan is available until ${ymd(plan.availableTo)}`;
    }
  }

  const days = Number(values.paymentTermDays);
  if (values.paymentTermDays.trim() === "" || !Number.isInteger(days) || days < 0 || days > 365) {
    errors.paymentTermDays = "Enter whole days from 0 to 365";
  }

  const lines = values.lines;
  if (lines.length === 0) {
    errors.lines = "Add at least one line";
  } else if (lines.some((l) => !l.productId)) {
    errors.lines = "Choose a product on every line";
  } else if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)) {
    errors.lines = "Quantity must be a whole number, at least 1";
  } else if (plan) {
    const total = lines.reduce((sum, l) => sum + l.quantity, 0);
    if (total < plan.minQuantity) errors.lines = `This plan requires a minimum quantity of ${plan.minQuantity}`;
  }
  return errors;
}

const FIELD_KEYS: Record<string, keyof FormErrors> = {
  customerId: "customerId",
  planId: "planId",
  startDate: "startDate",
  endDate: "endDate",
  paymentTermDays: "paymentTermDays",
  lines: "lines",
};

/** Turn the API error text into per-field messages (zod joins "path: message" with "; "). */
export function parseServerError(message: string): { fields: FormErrors; general: string | null } {
  const fields: FormErrors = {};
  const rest: string[] = [];
  for (const part of message.split("; ")) {
    const match = /^([A-Za-z]+)(?:\.[\w.]+)?: (.+)$/.exec(part);
    const key = match ? FIELD_KEYS[match[1]] : undefined;
    if (match && key) fields[key] = match[2];
    else rest.push(part);
  }
  if (rest.length === 0) return { fields, general: null };

  const text = rest.join("; ");
  const lower = text.toLowerCase();
  const target: keyof FormErrors | null =
    lower.includes("minimum quantity") || lower.includes("at least one line")
      ? "lines"
      : lower.includes("not available") || lower.includes("no longer available")
        ? "startDate"
        : lower.includes("customer not found")
          ? "customerId"
          : lower.includes("plan not found")
            ? "planId"
            : null;
  if (target) return { fields: { ...fields, [target]: text }, general: null };
  return { fields, general: text };
}

// ---- form view actions ----

export type ActionId = "quote" | "confirm" | "activate" | "pause" | "resume" | "renew" | "close" | "invoice";

export interface ActionFlags {
  pausable: boolean;
  closable: boolean;
  renewable: boolean;
  hasEndDate: boolean;
}

export interface ActionSpec {
  id: ActionId;
  label: string;
  primary: boolean;
}

/** Only the actions the API will accept for this state; invalid ones are left out, not disabled. */
export function availableActions(status: string, flags: ActionFlags): ActionSpec[] {
  switch (status) {
    case "DRAFT":
      return [{ id: "quote", label: "Send quotation", primary: true }];
    case "QUOTATION":
      return [{ id: "confirm", label: "Confirm", primary: true }];
    case "CONFIRMED":
      return [{ id: "activate", label: "Activate", primary: true }];
    case "ACTIVE":
      return [
        { id: "invoice", label: "Create invoice", primary: true },
        ...(flags.pausable ? [{ id: "pause" as const, label: "Pause", primary: false }] : []),
        ...(flags.renewable && flags.hasEndDate ? [{ id: "renew" as const, label: "Renew", primary: false }] : []),
        ...(flags.closable ? [{ id: "close" as const, label: "Close", primary: false }] : []),
      ];
    case "PAUSED":
      return [
        { id: "resume", label: "Resume", primary: true },
        ...(flags.closable ? [{ id: "close" as const, label: "Close", primary: false }] : []),
      ];
    default:
      return [];
  }
}

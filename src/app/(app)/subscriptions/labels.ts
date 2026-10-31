// Display labels shared by the subscription screens.
import { formatINR } from "@/lib/money";
import type { CatalogPlan } from "./types";

const UNIT_NAMES: Record<string, string> = { DAY: "day", WEEK: "week", MONTH: "month", YEAR: "year" };

/** "month", "3 months" */
export function periodLabel(unit: string, count: number): string {
  const name = UNIT_NAMES[unit] ?? unit.toLowerCase();
  return count === 1 ? name : `${count} ${name}s`;
}

/** "Monthly Starter · ₹2,400.00 / month": the plan's own list price, never a subscription total. */
export function planOptionLabel(plan: Pick<CatalogPlan, "name" | "price" | "periodUnit" | "periodCount">): string {
  return `${plan.name} · ${formatINR(plan.price)} / ${periodLabel(plan.periodUnit, plan.periodCount)}`;
}

export const percentLabel = (bps: number) =>
  `${(bps / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;

/** "Brightloop CRM (Seats: 10)" built from product and variant data. */
export function lineDescription(productName: string, variant?: { attribute: string; value: string } | null): string {
  return variant ? `${productName} (${variant.attribute}: ${variant.value})` : productName;
}

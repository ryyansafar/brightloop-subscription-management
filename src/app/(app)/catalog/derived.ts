import type { Tone } from "@/components";

export interface DiscountValidity {
  active: boolean;
  startsAt: Date;
  endsAt: Date;
  usedCount: number;
  usageLimit: number | null;
}

export interface DerivedStatus {
  label: "Inactive" | "Expired" | "Upcoming" | "Exhausted" | "Active";
  tone: Tone;
}

/** Badge for a discount, derived from its validity window and usage rather than the `active` flag alone. */
export function discountStatus(d: DiscountValidity, now: Date): DerivedStatus {
  if (!d.active) return { label: "Inactive", tone: "neutral" };
  if (d.endsAt < now) return { label: "Expired", tone: "danger" };
  if (d.startsAt > now) return { label: "Upcoming", tone: "info" };
  if (d.usageLimit != null && d.usedCount >= d.usageLimit) return { label: "Exhausted", tone: "warning" };
  return { label: "Active", tone: "success" };
}

const UNIT_NOUN: Record<string, string> = { DAY: "day", WEEK: "week", MONTH: "month", YEAR: "year" };

/** "Every month", "Every 3 months", "Every week". */
export function billingPeriodLabel(periodCount: number, periodUnit: string): string {
  const noun = UNIT_NOUN[periodUnit] ?? periodUnit.toLowerCase();
  return periodCount > 1 ? `Every ${periodCount} ${noun}s` : `Every ${noun}`;
}

interface PlanFlags {
  renewable: boolean;
  pausable: boolean;
  closable: boolean;
  autoClose: boolean;
}

/** Compact summary of plan flags for one-line rows: `text` is shown, `full` goes in the tooltip. */
export function planFlagSummary(plan: PlanFlags): { text: string; full: string } {
  const names = [
    plan.renewable && "Renewable",
    plan.pausable && "Pausable",
    plan.closable && "Closable",
    plan.autoClose && "Auto-close",
  ].filter((n): n is string => Boolean(n));
  if (names.length === 0) return { text: "None", full: "No lifecycle options enabled" };
  const text = names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
  return { text, full: names.join(", ") };
}

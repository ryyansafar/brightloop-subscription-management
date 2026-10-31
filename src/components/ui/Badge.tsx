// Owner: fathima. Coloured pill for statuses. `StatusBadge` maps app statuses to a tone.
import type { ReactNode } from "react";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

// Subscription and invoice statuses (see src/lib/state.ts), plus derived ones like OVERDUE.
const STATUS_TONES: Record<string, Tone> = {
  DRAFT: "neutral",
  QUOTATION: "info",
  CONFIRMED: "primary",
  ACTIVE: "success",
  PAUSED: "warning",
  CLOSED: "neutral",
  PAID: "success",
  CANCELLED: "danger",
  OVERDUE: "danger",
  OUTSTANDING: "warning",
};

/** "IN_PROGRESS" -> "In progress" */
export function humanize(value: string) {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{humanize(status)}</Badge>;
}

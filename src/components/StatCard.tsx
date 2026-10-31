// Owner: fathima. KPI tile for the dashboard. Format the value before passing it (e.g. formatINR).
import Link from "next/link";
import type { Tone } from "./ui/Badge";

const ACCENTS: Record<Tone, string> = {
  neutral: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  /** Makes the tile a link, e.g. overdue -> /invoices?overdue=1 */
  href?: string;
}

export function StatCard({ label, value, hint, tone = "neutral", href }: StatCardProps) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${ACCENTS[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  const classes = "block rounded-lg border border-line bg-surface p-4";
  return href ? (
    <Link href={href} className={`${classes} hover:border-primary`}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

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
      {/* Stitch style: caps label, large Plus Jakarta numeral, hint under a hairline. */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">{label}</p>
      <p className={`mt-2 font-display text-xl font-bold tracking-tight tabular-nums sm:text-[28px] sm:leading-9 ${ACCENTS[tone]}`}>
        {value}
      </p>
      {hint && <p className="mt-3 border-t border-line pt-2 text-xs text-muted">{hint}</p>}
    </>
  );
  const classes = "block rounded-lg border border-line bg-surface p-3 shadow-sm sm:p-5";
  return href ? (
    <Link
      href={href}
      className={`${classes} transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
    >
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

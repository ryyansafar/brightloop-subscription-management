// Owner: fathima. Display formatting shared by list and form views. Money: use formatINR from @/lib/money.

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC", // billing dates are UTC midnights; local time would shift them a day
});

/** 31 Oct 2026 */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateFormat.format(typeof value === "string" ? new Date(value) : value);
}

/**
 * Billing periods end exclusively (the next period starts that day), so show the
 * last covered day: 15 Oct 2026 – 14 Nov 2026.
 */
export function formatPeriod(start: Date, endExclusive: Date): string {
  const last = new Date(endExclusive.getTime() - 86_400_000);
  return `${formatDate(start)} – ${formatDate(last < start ? start : last)}`;
}

/** YYYY-MM-DD for <input type="date">, in the viewer's local calendar (IST "today", not UTC). */
export function toDateInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

import type { PeriodUnit } from "./state";

// All billing dates are handled in UTC so a period never shifts with the server timezone.
const DAY_MS = 86_400_000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Add whole months, clamping to the last day of the target month.
 * `anchorDay` is the original day of month: Jan 31 + 1 month = Feb 28, but
 * Feb 28 + 1 month with anchor 31 = Mar 31 (no drift to the 28th).
 */
export function addMonthsClamped(
  date: Date,
  months: number,
  anchorDay: number = date.getUTCDate(),
): Date {
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const monthIndex = total - year * 12;
  const day = Math.min(anchorDay, daysInMonth(year, monthIndex));
  return new Date(
    Date.UTC(
      year,
      monthIndex,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/** Start of the next billing period (the end of this one is exclusive). */
export function addPeriod(
  start: Date,
  unit: PeriodUnit,
  count: number,
  anchorDay?: number,
): Date {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`Invalid period count: ${count}`);
  }
  switch (unit) {
    case "DAY":
      return addDays(start, count);
    case "WEEK":
      return addDays(start, 7 * count);
    case "MONTH":
      return addMonthsClamped(start, count, anchorDay);
    case "YEAR":
      return addMonthsClamped(start, 12 * count, anchorDay);
  }
}

export function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

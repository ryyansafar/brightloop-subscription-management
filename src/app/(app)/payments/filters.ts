import { param, type Params } from "@/components";

const DAY_MS = 86_400_000;

function parseDay(value: string | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : date;
}

export interface DateRange {
  /** Inclusive start, UTC midnight. */
  from?: Date;
  /** Exclusive end (the day after the chosen "to" date). */
  toExclusive?: Date;
  /** The chosen dates as typed, for refilling the form. */
  fromInput?: string;
  toInput?: string;
  /** True when both dates are set and "to" is before "from". */
  reversed: boolean;
}

/** Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD. Invalid values are ignored; "to" is inclusive in the UI. */
export function readDateRange(params: Params): DateRange {
  const from = parseDay(param(params, "from"));
  const to = parseDay(param(params, "to"));
  const reversed = Boolean(from && to && to < from);
  return {
    from: reversed ? undefined : from,
    toExclusive: to && !reversed ? new Date(to.getTime() + DAY_MS) : undefined,
    fromInput: from?.toISOString().slice(0, 10),
    toInput: to?.toISOString().slice(0, 10),
    reversed,
  };
}

import { formatDate as baseFormatDate, toDateInput as baseToDateInput } from "@/components";
import { formatINR, rupees } from "@/lib/money";
import type { Role } from "@/lib/state";

/** Currency formatting from integer paise to INR display (e.g. 240000 -> "₹2,400.00") */
export function formatPaiseToRupees(paise: number): string {
  return formatINR(paise);
}

/** Formats integer paise as INR currency string (alias for formatPaiseToRupees/formatINR). */
export function formatPaiseINR(paise: number): string {
  return formatINR(paise);
}

/** Decimal string for input defaultValue (e.g. 240000 -> "2400.00") */
export function toRupeesInput(paise: number | null | undefined): string {
  if (paise == null) return "";
  return rupees(paise).toFixed(2);
}

/** Converts integer paise to rupees as number (paise / 100). */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * Parses user rupee input string into integer paise.
 * Accepts "1500", "1500.50", "1,500.50". Rejects negative numbers or > 2 decimals.
 * Returns null if invalid.
 */
export function parseRupeesToPaise(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  const clean = String(input).replaceAll(",", "").trim();
  if (!clean || !/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const num = Number(clean);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

/**
 * Parses user rupee input (e.g. "1,500.50", "1500", "0.25") to integer paise.
 * Throws an Error with a readable message if input is invalid or negative.
 */
export function rupeesToPaise(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("Price must be a valid number");
    if (input < 0) throw new Error("Price cannot be negative");
    return Math.round(input * 100);
  }
  const clean = input.replaceAll(",", "").trim();
  if (!clean) throw new Error("Price is required");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
    if (Number(clean) < 0) throw new Error("Price cannot be negative");
    throw new Error("Enter a valid price with at most 2 decimal places");
  }
  return Math.round(Number(clean) * 100);
}

/** Formats basis points into percentage display string (e.g. 1800 -> "18%", 550 -> "5.5%") */
export function formatBpsToPercent(bps: number): string {
  const pct = bps / 100;
  return `${Number(pct.toFixed(2))}%`;
}

/** Converts integer basis points to a percentage number (e.g. 1800 -> 18). */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/** Formats basis points as percentage string (e.g. 1800 -> "18%", 1850 -> "18.50%"). */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}

/** Decimal string for percentage input defaultValue (e.g. 1800 -> "18", 550 -> "5.5") */
export function toPercentInput(bps: number | null | undefined): string {
  if (bps == null) return "";
  const pct = bps / 100;
  return Number(pct.toFixed(2)).toString();
}

/**
 * Parses percentage string into integer basis points.
 * Accepts "18", "18.5", "18.5%". Validates range: 0% <= rate <= 100% (0 to 10000 bps).
 * Returns null if invalid.
 */
export function parsePercentToBps(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  const clean = String(input).replace(/%$/, "").trim();
  if (!clean || !/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const num = Number(clean);
  if (!Number.isFinite(num) || num < 0 || num > 100) return null;
  return Math.round(num * 100);
}

/**
 * Parses a percentage input (e.g. "18", "18.5", 18) to basis points (1800 bps = 18%).
 * Rejects values < 0% or > 100% (10000 bps).
 */
export function percentToBps(input: string | number): number {
  const num = typeof input === "number" ? input : Number(input.replaceAll("%", "").trim());
  if (Number.isNaN(num)) throw new Error("Rate must be a valid percentage");
  if (num < 0) throw new Error("Rate cannot be negative");
  if (num > 100) throw new Error("Rate cannot exceed 100%");
  return Math.round(num * 100);
}

/** Formats date into standard "31 Oct 2026" display */
export function formatDate(value: Date | string | null | undefined): string {
  return baseFormatDate(value);
}

/** Converts Date/string to "YYYY-MM-DD" for <input type="date"> */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return baseToDateInput(d);
}

/** Resolves current user role in Server Components */
export async function getCatalogUserRole(): Promise<Role> {
  const { cookies } = await import("next/headers");
  const { getSessionUser } = await import("@/lib/auth/session");
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  const session = await getSessionUser(new Request("http://app.local", { headers: { cookie } }));
  return session?.role ?? "CUSTOMER";
}

// All money is integer paise. Format only at the UI edge.

export function rupees(paise: number): number {
  return paise / 100;
}

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(rupees(paise));
}

/** Percentage of an amount in basis points, rounded half-up. */
export function percentOf(amountPaise: number, bps: number): number {
  return Math.round((amountPaise * bps) / 10_000);
}

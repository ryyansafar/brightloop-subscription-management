import { percentOf } from "./money";

export interface DiscountRule {
  id: number;
  kind: "FIXED" | "PERCENT";
  /** paise for FIXED, basis points for PERCENT */
  value: number;
  minAmount: number;
  minQuantity: number;
  scope: "PRODUCT" | "SUBSCRIPTION";
  productId: number | null;
}

export interface PricingLine {
  description: string;
  productId: number;
  quantity: number;
  unitPrice: number;
  taxBps: number;
}

export interface PricedLine extends PricingLine {
  gross: number;
  discountAmount: number;
  /** product-level rule applied to this line */
  discountId: number | null;
  /** gross minus all discounts, before tax */
  net: number;
  taxAmount: number;
}

export interface PricedInvoice {
  lines: PricedLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  /** subscription-level rule applied across the invoice */
  subscriptionDiscountId: number | null;
}

/** Discount value for a base amount, never more than the base. */
export function discountAmount(rule: DiscountRule, base: number): number {
  const raw = rule.kind === "FIXED" ? rule.value : percentOf(base, rule.value);
  return Math.max(0, Math.min(raw, base));
}

function isEligible(rule: DiscountRule, amount: number, quantity: number): boolean {
  return amount >= rule.minAmount && quantity >= rule.minQuantity && amount > 0;
}

function bestRule(
  rules: DiscountRule[],
  amount: number,
  quantity: number,
): { rule: DiscountRule; amount: number } | null {
  let best: { rule: DiscountRule; amount: number } | null = null;
  for (const rule of rules) {
    if (!isEligible(rule, amount, quantity)) continue;
    const value = discountAmount(rule, amount);
    if (value > 0 && (!best || value > best.amount)) best = { rule, amount: value };
  }
  return best;
}

/** Spread `total` across weights, giving rounding leftovers to the last non-zero weight. */
function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0 || total === 0) return weights.map(() => 0);
  const shares = weights.map((w) => Math.floor((total * w) / sum));
  const lastIndex = weights.reduce((acc, w, i) => (w > 0 ? i : acc), 0);
  shares[lastIndex] += total - shares.reduce((a, b) => a + b, 0);
  return shares;
}

/**
 * Order of operations: product discount per line, then one subscription-level
 * discount over the remaining total (spread across lines), then tax per line.
 * Each level uses only the single best eligible rule.
 */
export function priceInvoice(lines: PricingLine[], rules: DiscountRule[]): PricedInvoice {
  const productRules = rules.filter((r) => r.scope === "PRODUCT");
  const subscriptionRules = rules.filter((r) => r.scope === "SUBSCRIPTION");

  const stage1 = lines.map((line) => {
    const gross = line.quantity * line.unitPrice;
    const applicable = productRules.filter((r) => r.productId === line.productId);
    const best = bestRule(applicable, gross, line.quantity);
    const lineDiscount = best?.amount ?? 0;
    return { line, gross, lineDiscount, discountId: best?.rule.id ?? null };
  });

  const afterLine = stage1.map((s) => s.gross - s.lineDiscount);
  const remaining = afterLine.reduce((a, b) => a + b, 0);
  const totalQuantity = lines.reduce((a, l) => a + l.quantity, 0);
  const subBest = bestRule(subscriptionRules, remaining, totalQuantity);
  const shares = allocate(subBest?.amount ?? 0, afterLine);

  const priced: PricedLine[] = stage1.map((s, i) => {
    const discount = s.lineDiscount + shares[i];
    const net = s.gross - discount;
    return {
      ...s.line,
      gross: s.gross,
      discountAmount: discount,
      discountId: s.discountId,
      net,
      taxAmount: percentOf(net, s.line.taxBps),
    };
  });

  const subtotal = priced.reduce((a, l) => a + l.gross, 0);
  const discountTotal = priced.reduce((a, l) => a + l.discountAmount, 0);
  const taxTotal = priced.reduce((a, l) => a + l.taxAmount, 0);
  return {
    lines: priced,
    subtotal,
    discountTotal,
    taxTotal,
    total: subtotal - discountTotal + taxTotal,
    subscriptionDiscountId: subBest?.rule.id ?? null,
  };
}

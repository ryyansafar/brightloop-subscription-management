// Reads for the subscription form view. Totals use the same pricing engine and discount rules billing uses.
import { db } from "@/lib/db";
import { addPeriod } from "@/lib/dates";
import { loadDiscountRules } from "@/lib/discount-usage";
import type { PeriodUnit } from "@/lib/state";
import { lineDescription } from "./labels";
import { orderTotals } from "./logic";

export async function getSubscription(id: number) {
  const sub = await db.subscription.findUnique({
    where: { id },
    include: {
      customer: true,
      plan: true,
      lines: { orderBy: { id: "asc" } },
      invoices: {
        select: { id: true, number: true, status: true, total: true, dueDate: true, periodStart: true },
        orderBy: { periodStart: "desc" },
      },
    },
  });
  if (!sub) return null;

  const productIds = [...new Set(sub.lines.map((l) => l.productId))];
  const variantIds = sub.lines.flatMap((l) => (l.variantOptionId ? [l.variantOptionId] : []));
  const [products, variants, rules] = await Promise.all([
    db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }),
    db.variantOption.findMany({ where: { id: { in: variantIds } } }),
    // the rules that apply on the date of the next invoice, so these totals match it
    loadDiscountRules(db, sub.nextInvoiceDate ?? sub.startDate),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const priced = orderTotals(sub.lines, rules);
  const lines = sub.lines.map((l, i) => ({
    id: l.id,
    description: lineDescription(
      productById.get(l.productId)?.name ?? `Product ${l.productId}`,
      l.variantOptionId ? variantById.get(l.variantOptionId) : null,
    ),
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxBps: l.taxBps,
    discountAmount: priced.lines[i].discountAmount,
    net: priced.lines[i].net,
  }));

  const renewTo =
    sub.status === "ACTIVE" && sub.plan.renewable && sub.endDate
      ? addPeriod(sub.endDate, sub.plan.periodUnit as PeriodUnit, sub.plan.periodCount, sub.anchorDay ?? undefined)
      : null;

  return { sub, lines, totals: priced, renewTo };
}

export type SubscriptionDetail = NonNullable<Awaited<ReturnType<typeof getSubscription>>>;

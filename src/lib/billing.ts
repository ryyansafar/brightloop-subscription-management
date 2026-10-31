import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { addDays, addPeriod, formatYmd } from "./dates";
import { consumeDiscount, loadDiscountRules, releaseDiscount } from "./discount-usage";
import { DomainError } from "./errors";
import { priceInvoice, type DiscountRule, type PricedInvoice, type PricingLine } from "./pricing";
import type { PeriodUnit } from "./state";

type Tx = Prisma.TransactionClient;

/** Safety stop so a bad date can never loop forever (e.g. a daily plan years behind). */
const MAX_CATCH_UP_PERIODS = 366;

export interface BillingResult {
  /** subscriptions that were due */
  due: number;
  invoicesCreated: number;
  /** periods that already had an invoice (nothing billed twice) */
  periodsSkipped: number;
  subscriptionsClosed: number;
  invoiceIds: number[];
  errors: { subscriptionId: number; message: string }[];
}

interface BillOptions {
  today: Date;
  /** Bill the next period even if it is not due yet (manual "create invoice"). */
  force?: boolean;
}

interface BillOutcome {
  invoiceIds: number[];
  skipped: number;
  closed: boolean;
}

/**
 * Invoice every ACTIVE subscription whose next invoice date has passed.
 * Safe to run repeatedly: each period is unique per subscription, and missed
 * periods are caught up one at a time, so none is skipped or billed twice.
 */
export async function runBilling(
  today: Date = new Date(),
  client: PrismaClient = db,
): Promise<BillingResult> {
  const due = await client.subscription.findMany({
    where: { status: "ACTIVE", nextInvoiceDate: { lte: today } },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const result: BillingResult = {
    due: due.length,
    invoicesCreated: 0,
    periodsSkipped: 0,
    subscriptionsClosed: 0,
    invoiceIds: [],
    errors: [],
  };

  for (const { id } of due) {
    try {
      const outcome = await client.$transaction((tx) => billSubscription(tx, id, { today }), {
        timeout: 30_000,
      });
      result.invoicesCreated += outcome.invoiceIds.length;
      result.periodsSkipped += outcome.skipped;
      result.invoiceIds.push(...outcome.invoiceIds);
      if (outcome.closed) result.subscriptionsClosed += 1;
    } catch (error) {
      result.errors.push({
        subscriptionId: id,
        message: error instanceof Error ? error.message : "Unknown billing error",
      });
    }
  }
  return result;
}

/** Bill one subscription inside the caller's transaction. */
export async function billSubscription(
  tx: Tx,
  subscriptionId: number,
  { today, force = false }: BillOptions,
): Promise<BillOutcome> {
  const sub = await tx.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, lines: true },
  });
  if (!sub) throw new DomainError("Subscription not found", 404);
  if (sub.status !== "ACTIVE") throw new DomainError("Only active subscriptions can be billed", 409);

  const outcome: BillOutcome = { invoiceIds: [], skipped: 0, closed: false };
  let next = sub.nextInvoiceDate;
  let status = sub.status;
  let closeReason = sub.closeReason;

  for (let step = 0; step < MAX_CATCH_UP_PERIODS && status === "ACTIVE" && next; step++) {
    const handled = outcome.invoiceIds.length + outcome.skipped;
    if (!(next <= today || (force && handled === 0))) break;

    if (sub.endDate && next >= sub.endDate) {
      // the subscription has run its course; nothing more to bill
      if (sub.plan.autoClose) {
        status = "CLOSED";
        closeReason = "Plan ended";
        outcome.closed = true;
      }
      next = null;
      break;
    }

    const periodStart = next;
    const periodEnd = addPeriod(
      periodStart,
      sub.plan.periodUnit as PeriodUnit,
      sub.plan.periodCount,
      sub.anchorDay ?? undefined,
    );

    const existing = await tx.invoice.findUnique({
      where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } },
      select: { id: true },
    });
    if (existing) {
      outcome.skipped += 1;
    } else if (sub.lines.length > 0) {
      outcome.invoiceIds.push(await createInvoice(tx, sub, periodStart, periodEnd));
    }

    next = periodEnd;
    if (sub.endDate && next >= sub.endDate && sub.plan.autoClose) {
      status = "CLOSED";
      closeReason = "Plan ended";
      outcome.closed = true;
      next = null;
    }
  }

  await tx.subscription.update({
    where: { id: sub.id },
    data: { nextInvoiceDate: next, status, closeReason },
  });
  return outcome;
}

type SubscriptionWithLines = Prisma.SubscriptionGetPayload<{
  include: { plan: true; lines: true };
}>;

async function createInvoice(
  tx: Tx,
  sub: SubscriptionWithLines,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const products = await tx.product.findMany({
    where: { id: { in: sub.lines.map((l) => l.productId) } },
  });
  const variantIds = sub.lines.flatMap((l) => (l.variantOptionId ? [l.variantOptionId] : []));
  const variants = await tx.variantOption.findMany({ where: { id: { in: variantIds } } });
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const pricingLines: PricingLine[] = sub.lines.map((line) => {
    const product = productById.get(line.productId);
    const variant = line.variantOptionId ? variantById.get(line.variantOptionId) : undefined;
    const label = product?.name ?? `Product ${line.productId}`;
    return {
      description: variant ? `${label} (${variant.attribute}: ${variant.value})` : label,
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxBps: line.taxBps,
    };
  });

  const rules = await loadDiscountRules(tx, periodStart);
  const priced = await priceAndConsume(tx, pricingLines, rules);

  const invoice = await tx.invoice.create({
    data: {
      number: `INV-${sub.number}-${formatYmd(periodStart)}`,
      subscriptionId: sub.id,
      customerId: sub.customerId,
      periodStart,
      periodEnd,
      status: "DRAFT",
      subtotal: priced.subtotal,
      discountTotal: priced.discountTotal,
      taxTotal: priced.taxTotal,
      total: priced.total,
      dueDate: addDays(periodStart, sub.paymentTermDays),
      discountId: priced.subscriptionDiscountId,
      lines: {
        create: priced.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountAmount: l.discountAmount,
          discountId: l.discountId,
          taxBps: l.taxBps,
          taxAmount: l.taxAmount,
          amount: l.net,
        })),
      },
    },
    select: { id: true },
  });
  return invoice.id;
}

function appliedRuleIds(priced: PricedInvoice): number[] {
  const ids = new Set<number>();
  if (priced.subscriptionDiscountId !== null) ids.add(priced.subscriptionDiscountId);
  for (const line of priced.lines) if (line.discountId !== null) ids.add(line.discountId);
  return [...ids];
}

/**
 * Price the invoice and take one use of every discount it applied. If a limit
 * was reached in the meantime, undo this attempt and price again without it.
 */
async function priceAndConsume(
  tx: Tx,
  lines: PricingLine[],
  rules: DiscountRule[],
): Promise<PricedInvoice> {
  let candidates = rules;
  for (let attempt = 0; attempt <= rules.length; attempt++) {
    const priced = priceInvoice(lines, candidates);
    const consumed: number[] = [];
    const failed: number[] = [];
    for (const id of appliedRuleIds(priced)) {
      if (await consumeDiscount(tx, id)) consumed.push(id);
      else failed.push(id);
    }
    if (failed.length === 0) return priced;
    for (const id of consumed) await releaseDiscount(tx, id);
    candidates = candidates.filter((r) => !failed.includes(r.id));
  }
  return priceInvoice(lines, []);
}

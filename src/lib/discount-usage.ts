import type { Prisma } from "@prisma/client";
import type { DiscountRule } from "./pricing";

type Tx = Prisma.TransactionClient;

/** Active discounts valid on `at` that still have uses left. */
export async function loadDiscountRules(tx: Tx, at: Date): Promise<DiscountRule[]> {
  const rows = await tx.discount.findMany({
    where: { active: true, startsAt: { lte: at }, endsAt: { gte: at } },
  });
  return rows
    .filter((d) => d.usageLimit === null || d.usedCount < d.usageLimit)
    .map((d) => ({
      id: d.id,
      kind: d.kind as DiscountRule["kind"],
      value: d.value,
      minAmount: d.minAmount,
      minQuantity: d.minQuantity,
      scope: d.scope as DiscountRule["scope"],
      productId: d.productId,
    }));
}

/** Atomically take one use. Returns false when the limit was already reached. */
export async function consumeDiscount(tx: Tx, id: number): Promise<boolean> {
  const changed = await tx.$executeRaw`
    UPDATE "Discount" SET "usedCount" = "usedCount" + 1
    WHERE "id" = ${id} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
  return changed === 1;
}

export async function releaseDiscount(tx: Tx, id: number): Promise<void> {
  await tx.$executeRaw`
    UPDATE "Discount" SET "usedCount" = MAX("usedCount" - 1, 0) WHERE "id" = ${id}`;
}

/** Give back every use an invoice consumed (used when it is cancelled). */
export async function releaseInvoiceDiscounts(
  tx: Tx,
  invoice: { discountId: number | null; lines: { discountId: number | null }[] },
): Promise<void> {
  const ids = new Set<number>();
  if (invoice.discountId !== null) ids.add(invoice.discountId);
  for (const line of invoice.lines) if (line.discountId !== null) ids.add(line.discountId);
  for (const id of ids) await releaseDiscount(tx, id);
}

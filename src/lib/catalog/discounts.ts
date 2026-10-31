import type { Discount, Prisma } from "@prisma/client";
import { db } from "../db";
import { DomainError } from "../errors";
import { pageParams } from "../api";
import { activeFilter, guard } from "./guard";
import type { Resource } from "./resource";
import { discountBase, discountSchema } from "./schemas";

async function loadDiscount(id: number): Promise<Discount> {
  const discount = await db.discount.findUnique({ where: { id } });
  if (!discount) throw new DomainError("Discount not found", 404);
  return discount;
}

async function assertProductExists(productId: number | null | undefined): Promise<void> {
  if (!productId) return;
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new DomainError("Product not found", 404);
}

/**
 * Admin-managed rules only. Evaluation and the `usedCount` bookkeeping belong to the
 * billing engine (src/lib/pricing.ts, discount-usage.ts); `usedCount` is never writable here.
 */
export const discountService: Resource<Discount> = {
  async list(url) {
    const { page, take, skip } = pageParams(url);
    const now = new Date();
    const state = url.searchParams.get("state"); // running | expired | upcoming | exhausted
    const where: Prisma.DiscountWhereInput = {
      ...activeFilter(url),
      ...(state === "running" ? { startsAt: { lte: now }, endsAt: { gte: now } } : {}),
      ...(state === "expired" ? { endsAt: { lt: now } } : {}),
      ...(state === "upcoming" ? { startsAt: { gt: now } } : {}),
    };
    const [rows, total] = await Promise.all([
      db.discount.findMany({ where, orderBy: { id: "asc" }, take, skip }),
      db.discount.count({ where }),
    ]);
    const items =
      state === "exhausted"
        ? rows.filter((d) => d.usageLimit !== null && d.usedCount >= d.usageLimit)
        : rows;
    return { items, total: state === "exhausted" ? items.length : total, page, limit: take };
  },

  get: loadDiscount,

  async create(input) {
    const data = discountSchema.parse(input);
    await assertProductExists(data.productId);
    return guard(() => db.discount.create({ data: { ...data, productId: data.productId ?? null } }), "discount");
  },

  async update(id, input) {
    const patch = discountBase.partial().parse(input);
    if (Object.keys(patch).length === 0) throw new DomainError("Nothing to update");
    const existing = await loadDiscount(id);
    const merged = discountSchema.parse({ ...existing, ...patch });

    if (merged.usageLimit != null && merged.usageLimit < existing.usedCount) {
      throw new DomainError(
        `Usage limit cannot be below the ${existing.usedCount} uses already counted`,
        409,
      );
    }
    await assertProductExists(merged.productId);
    return guard(
      () => db.discount.update({ where: { id }, data: { ...merged, productId: merged.productId ?? null } }),
      "discount",
    );
  },

  async remove(id) {
    await loadDiscount(id);
    // Invoices reference the rule for usage release, so retire it instead of deleting.
    await db.discount.update({ where: { id }, data: { active: false } });
    return { id, active: false };
  },
};

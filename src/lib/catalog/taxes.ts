import type { Prisma, TaxRate } from "@prisma/client";
import { db } from "../db";
import { DomainError } from "../errors";
import { pageParams } from "../api";
import { activeFilter, guard } from "./guard";
import type { Resource } from "./resource";
import { taxSchema } from "./schemas";

async function loadTax(id: number): Promise<TaxRate> {
  const tax = await db.taxRate.findUnique({ where: { id } });
  if (!tax) throw new DomainError("Tax rate not found", 404);
  return tax;
}

export const taxService: Resource<TaxRate> = {
  async list(url) {
    const { page, take, skip } = pageParams(url);
    const where: Prisma.TaxRateWhereInput = activeFilter(url);
    const [items, total] = await Promise.all([
      db.taxRate.findMany({ where, orderBy: { id: "asc" }, take, skip }),
      db.taxRate.count({ where }),
    ]);
    return { items, total, page, limit: take };
  },

  get: loadTax,

  create: (input) => guard(() => db.taxRate.create({ data: taxSchema.parse(input) }), "tax rate"),

  async update(id, input) {
    const patch = taxSchema.partial().parse(input);
    if (Object.keys(patch).length === 0) throw new DomainError("Nothing to update");
    await loadTax(id);
    // Subscription lines snapshot the rate, so edits only affect new subscriptions.
    return guard(() => db.taxRate.update({ where: { id }, data: patch }), "tax rate");
  },

  async remove(id) {
    await loadTax(id);
    await db.taxRate.update({ where: { id }, data: { active: false } });
    return { id, active: false };
  },
};

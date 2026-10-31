import type { Plan, Prisma } from "@prisma/client";
import { db } from "../db";
import { DomainError } from "../errors";
import { pageParams } from "../api";
import { activeFilter, guard } from "./guard";
import type { Resource } from "./resource";
import { planBase, planSchema } from "./schemas";

const BILLING_STATUSES = ["CONFIRMED", "ACTIVE", "PAUSED"];

async function loadPlan(id: number): Promise<Plan> {
  const plan = await db.plan.findUnique({ where: { id } });
  if (!plan) throw new DomainError("Plan not found", 404);
  return plan;
}

export const planService: Resource<Plan> = {
  async list(url) {
    const { page, take, skip } = pageParams(url);
    const q = url.searchParams.get("q")?.trim();
    const unit = url.searchParams.get("periodUnit");
    const where: Prisma.PlanWhereInput = {
      ...activeFilter(url),
      ...(q ? { name: { contains: q } } : {}),
      ...(unit ? { periodUnit: unit } : {}),
    };
    const [items, total] = await Promise.all([
      db.plan.findMany({ where, orderBy: { id: "asc" }, take, skip }),
      db.plan.count({ where }),
    ]);
    return { items, total, page, limit: take };
  },

  get: loadPlan,

  create: (input) => guard(() => db.plan.create({ data: planSchema.parse(input) }), "plan"),

  async update(id, input) {
    const patch = planBase.partial().parse(input);
    if (Object.keys(patch).length === 0) throw new DomainError("Nothing to update");
    const existing = await loadPlan(id);
    // Re-check the whole record so cross-field rules (dates) still hold after a partial edit.
    const merged = planSchema.parse({ ...existing, ...patch });

    const periodChanged =
      merged.periodUnit !== existing.periodUnit || merged.periodCount !== existing.periodCount;
    if (periodChanged) {
      const live = await db.subscription.count({
        where: { planId: id, status: { in: BILLING_STATUSES } },
      });
      if (live > 0) {
        throw new DomainError(
          `${live} subscriptions are billing on this plan; create a new plan instead of changing its period`,
          409,
        );
      }
    }
    return guard(() => db.plan.update({ where: { id }, data: merged }), "plan");
  },

  async remove(id) {
    await loadPlan(id);
    await db.plan.update({ where: { id }, data: { active: false } });
    return { id, active: false };
  },
};

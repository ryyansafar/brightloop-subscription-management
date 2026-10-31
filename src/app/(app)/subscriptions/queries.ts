import { requirePageRole } from "@/lib/auth/current-user";
// Reads for the subscription list. Aggregates run in SQL so 3,000 subscriptions stay fast and nothing is N+1.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "@/lib/state";
import { sumMrr, type MrrGroup } from "./logic";

export const PAGE_SIZE = 20;
export const DUE_DAYS = 7;

export function parseStatus(value: string | undefined): SubscriptionStatus | undefined {
  const upper = value?.toUpperCase();
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(upper ?? "") ? (upper as SubscriptionStatus) : undefined;
}

export const SORT_KEYS = ["number", "start", "next", "amount"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export function parseSort(sort: string | undefined, dir: string | undefined): { sort: SortKey | undefined; dir: SortDir } {
  const key = (SORT_KEYS as readonly string[]).includes(sort ?? "") ? (sort as SortKey) : undefined;
  return { sort: key, dir: dir === "asc" ? "asc" : "desc" };
}

interface ListOptions {
  sort?: SortKey;
  dir?: SortDir;
  status?: SubscriptionStatus;
  q?: string;
  /** only active subscriptions whose next invoice falls within DUE_DAYS */
  dueSoon?: boolean;
  page: number;
  today: Date;
}

function whereFor(opts: ListOptions): Prisma.SubscriptionWhereInput {
  const q = opts.q?.trim();
  const upcoming = { gte: opts.today, lte: addDays(opts.today, DUE_DAYS) };
  return {
    ...(opts.dueSoon ? { status: "ACTIVE", nextInvoiceDate: upcoming } : opts.status ? { status: opts.status } : {}),
    ...(q ? { OR: [{ number: { contains: q } }, { customer: { name: { contains: q } } }] } : {}),
  };
}

/** Per-period amount (lines plus tax, rounded per line as billing does) for the given subscriptions. */
async function amountsFor(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db.$queryRaw<{ subscriptionId: number; amount: number | bigint }[]>`
    SELECT subscriptionId,
           SUM(quantity * unitPrice + ROUND(quantity * unitPrice * taxBps / 10000.0)) AS amount
    FROM SubscriptionLine
    WHERE subscriptionId IN (${Prisma.join(ids)})
    GROUP BY subscriptionId`;
  return new Map(rows.map((r) => [r.subscriptionId, Number(r.amount)]));
}

const SELECT = {
  id: true,
  number: true,
  status: true,
  startDate: true,
  endDate: true,
  nextInvoiceDate: true,
  customer: { select: { name: true } },
  plan: { select: { name: true } },
} satisfies Prisma.SubscriptionSelect;

function orderFor(sort: SortKey | undefined, dir: SortDir): Prisma.SubscriptionOrderByWithRelationInput[] {
  switch (sort) {
    case "number":
      return [{ number: dir }];
    case "start":
      return [{ startDate: dir }, { id: "desc" }];
    case "next":
      return [{ nextInvoiceDate: { sort: dir, nulls: "last" } }, { id: "desc" }];
    default:
      return [{ id: "desc" }];
  }
}

export async function listSubscriptions(opts: ListOptions) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const where = whereFor(opts);
  const dir = opts.dir ?? "desc";
  const skip = (opts.page - 1) * PAGE_SIZE;

  if (opts.sort === "amount") {
    // Amount lives in the lines table: rank every matching id in SQL-aggregated form, then fetch one page.
    const [ids, total] = await Promise.all([db.subscription.findMany({ where, select: { id: true } }), db.subscription.count({ where })]);
    const amounts = await amountsFor(ids.map((r) => r.id));
    const ranked = ids
      .map((r) => ({ id: r.id, amount: amounts.get(r.id) ?? 0 }))
      .sort((a, b) => (dir === "asc" ? a.amount - b.amount : b.amount - a.amount) || b.id - a.id)
      .slice(skip, skip + PAGE_SIZE);
    const found = await db.subscription.findMany({ where: { id: { in: ranked.map((r) => r.id) } }, select: SELECT });
    const byId = new Map(found.map((r) => [r.id, r]));
    const rows = ranked.flatMap((r) => {
      const row = byId.get(r.id);
      return row ? [{ ...row, amount: r.amount }] : [];
    });
    return { total, rows };
  }

  const [rows, total] = await Promise.all([
    db.subscription.findMany({ where, select: SELECT, orderBy: orderFor(opts.sort, dir), take: PAGE_SIZE, skip }),
    db.subscription.count({ where }),
  ]);
  const amounts = await amountsFor(rows.map((r) => r.id));
  return { total, rows: rows.map((r) => ({ ...r, amount: amounts.get(r.id) ?? 0 })) };
}

export type SubscriptionRow = Awaited<ReturnType<typeof listSubscriptions>>["rows"][number];

export async function subscriptionStats(today: Date) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const [active, dueSoon, groups] = await Promise.all([
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.subscription.count({
      where: { status: "ACTIVE", nextInvoiceDate: { gte: today, lte: addDays(today, DUE_DAYS) } },
    }),
    db.$queryRaw<{ periodUnit: string; periodCount: number; amount: number | bigint }[]>`
      SELECT p.periodUnit AS periodUnit, p.periodCount AS periodCount,
             SUM(l.quantity * l.unitPrice) AS amount
      FROM Subscription s
      JOIN Plan p ON p.id = s.planId
      JOIN SubscriptionLine l ON l.subscriptionId = s.id
      WHERE s.status = 'ACTIVE'
      GROUP BY p.periodUnit, p.periodCount`,
  ]);
  const mrr = sumMrr(groups.map((g): MrrGroup => ({ ...g, amount: Number(g.amount) })));
  return { active, dueSoon, mrr };
}

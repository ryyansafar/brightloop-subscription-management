// Owner: fathima. Dashboard numbers, computed with SQL aggregates (never loads all rows).
// Money is integer paise. Dates are stored by Prisma/SQLite as epoch milliseconds.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface DashboardFilters {
  from: Date; // inclusive
  to: Date; // exclusive
  planId?: number;
  today?: Date; // "now" for overdue checks; defaults to the real date
}

export interface DashboardSummary {
  activeSubscriptions: number;
  mrr: number;
  arr: number;
  revenue: number; // confirmed + paid invoices whose period starts in the range
  paymentsReceived: number; // payments dated in the range
  outstanding: number; // unpaid balance on confirmed invoices, as of today
  overdueCount: number;
  overdueAmount: number;
  churned: number; // subscriptions closed (endDate) in the range
}

export interface MonthPoint {
  month: string; // YYYY-MM
  revenue: number;
  payments: number;
}

// Converts a line's price per billing period into a monthly amount.
const MONTHLY_FACTOR = Prisma.sql`(CASE p.periodUnit
  WHEN 'DAY' THEN 365.0 / 12 WHEN 'WEEK' THEN 52.0 / 12
  WHEN 'MONTH' THEN 1.0 WHEN 'YEAR' THEN 1.0 / 12 END) / p.periodCount`;

function planClause(planId: number | undefined, column: Prisma.Sql) {
  return planId ? Prisma.sql`AND ${column} = ${planId}` : Prisma.empty;
}

const num = (v: unknown) => Number(v ?? 0);

export async function getDashboardSummary(f: DashboardFilters): Promise<DashboardSummary> {
  const from = f.from.getTime();
  const to = f.to.getTime();
  const today = (f.today ?? new Date()).getTime();
  const plan = planClause(f.planId, Prisma.sql`s.planId`);

  const [subs, revenue, payments, open, churn] = await Promise.all([
    db.$queryRaw<{ active: bigint; mrr: number | null }[]>`
      SELECT COUNT(DISTINCT s.id) AS active,
             SUM(l.quantity * l.unitPrice * ${MONTHLY_FACTOR}) AS mrr
      FROM Subscription s
      JOIN Plan p ON p.id = s.planId
      LEFT JOIN SubscriptionLine l ON l.subscriptionId = s.id
      WHERE s.status = 'ACTIVE' ${plan}`,
    db.$queryRaw<{ total: bigint | null }[]>`
      SELECT SUM(i.total) AS total
      FROM Invoice i JOIN Subscription s ON s.id = i.subscriptionId
      WHERE i.status IN ('CONFIRMED', 'PAID')
        AND i.periodStart >= ${from} AND i.periodStart < ${to} ${plan}`,
    db.$queryRaw<{ total: bigint | null }[]>`
      SELECT SUM(pay.amount) AS total
      FROM Payment pay
      JOIN Invoice i ON i.id = pay.invoiceId
      JOIN Subscription s ON s.id = i.subscriptionId
      WHERE pay.paidOn >= ${from} AND pay.paidOn < ${to} ${plan}`,
    // Balance per confirmed invoice, then split into outstanding vs overdue.
    db.$queryRaw<{ outstanding: bigint | null; overdueCount: bigint; overdueAmount: bigint | null }[]>`
      SELECT SUM(b.balance) AS outstanding,
             SUM(CASE WHEN b.dueDate < ${today} THEN 1 ELSE 0 END) AS overdueCount,
             SUM(CASE WHEN b.dueDate < ${today} THEN b.balance ELSE 0 END) AS overdueAmount
      FROM (
        SELECT i.dueDate,
               i.total - COALESCE((SELECT SUM(amount) FROM Payment WHERE invoiceId = i.id), 0) AS balance
        FROM Invoice i JOIN Subscription s ON s.id = i.subscriptionId
        WHERE i.status = 'CONFIRMED' ${plan}
      ) b
      WHERE b.balance > 0`,
    db.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM Subscription s
      WHERE s.status = 'CLOSED' AND s.endDate >= ${from} AND s.endDate < ${to} ${plan}`,
  ]);

  const mrr = Math.round(num(subs[0]?.mrr));
  return {
    activeSubscriptions: num(subs[0]?.active),
    mrr,
    arr: mrr * 12,
    revenue: num(revenue[0]?.total),
    paymentsReceived: num(payments[0]?.total),
    outstanding: num(open[0]?.outstanding),
    overdueCount: num(open[0]?.overdueCount),
    overdueAmount: num(open[0]?.overdueAmount),
    churned: num(churn[0]?.n),
  };
}

/** Revenue and payments per calendar month (UTC) inside the range, for the chart. */
export async function getMonthlySeries(f: DashboardFilters): Promise<MonthPoint[]> {
  const from = f.from.getTime();
  const to = f.to.getTime();
  const plan = planClause(f.planId, Prisma.sql`s.planId`);
  const month = (col: Prisma.Sql) => Prisma.sql`strftime('%Y-%m', ${col} / 1000, 'unixepoch')`;

  const [rev, pay] = await Promise.all([
    db.$queryRaw<{ month: string; total: bigint }[]>`
      SELECT ${month(Prisma.sql`i.periodStart`)} AS month, SUM(i.total) AS total
      FROM Invoice i JOIN Subscription s ON s.id = i.subscriptionId
      WHERE i.status IN ('CONFIRMED', 'PAID')
        AND i.periodStart >= ${from} AND i.periodStart < ${to} ${plan}
      GROUP BY 1`,
    db.$queryRaw<{ month: string; total: bigint }[]>`
      SELECT ${month(Prisma.sql`pay.paidOn`)} AS month, SUM(pay.amount) AS total
      FROM Payment pay
      JOIN Invoice i ON i.id = pay.invoiceId
      JOIN Subscription s ON s.id = i.subscriptionId
      WHERE pay.paidOn >= ${from} AND pay.paidOn < ${to} ${plan}
      GROUP BY 1`,
  ]);

  const points = new Map<string, MonthPoint>();
  const at = (m: string) =>
    points.get(m) ?? points.set(m, { month: m, revenue: 0, payments: 0 }).get(m)!;
  for (const r of rev) at(r.month).revenue = num(r.total);
  for (const r of pay) at(r.month).payments = num(r.total);
  return [...points.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Plans for the dashboard's plan filter. */
export function getPlanOptions() {
  return db.plan.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

// Billing-day demo. Simulates "it is billing day and hundreds of subscriptions are due".
//   npm run demo:billing            rehearse on a throwaway copy of the database
//   npm run demo:billing -- --live  apply to the real database (use for the recording)
//   npm run demo:billing -- --as-of=2026-12-01
import { copyFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { runBilling } from "../src/lib/billing";
import { addDays, startOfDayUTC } from "../src/lib/dates";
import { formatINR } from "../src/lib/money";

const live = process.argv.includes("--live");
const asOfArg = process.argv.find((a) => a.startsWith("--as-of="))?.split("=")[1];
const now = startOfDayUTC(new Date());
const asOf = asOfArg ? new Date(`${asOfArg}T00:00:00.000Z`) : addDays(now, 31);

const out = (line = "") => process.stdout.write(`${line}\n`);
const heading = (title: string) => out(`\n=== ${title}`);

if (!live) {
  copyFileSync(path.resolve(__dirname, "../prisma/dev.db"), path.resolve(__dirname, "../prisma/demo.db"));
}
const db = new PrismaClient(live ? undefined : { datasourceUrl: "file:./demo.db" });

/** Normalise a plan period to a per-month multiplier (for MRR). */
function perMonth(unit: string, count: number): number {
  switch (unit) {
    case "DAY":
      return 30 / count;
    case "WEEK":
      return 52 / 12 / count;
    case "YEAR":
      return 1 / (12 * count);
    default:
      return 1 / count;
  }
}

async function snapshot(label: string) {
  const started = performance.now();
  const active = await db.subscription.findMany({
    where: { status: "ACTIVE" },
    select: {
      plan: { select: { periodUnit: true, periodCount: true } },
      lines: { select: { quantity: true, unitPrice: true } },
    },
  });
  const mrr = active.reduce((sum, s) => {
    const period = s.lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
    return sum + period * perMonth(s.plan.periodUnit, s.plan.periodCount);
  }, 0);

  const byStatus = await db.invoice.groupBy({ by: ["status"], _count: true, _sum: { total: true } });
  const received = await db.payment.aggregate({ _sum: { amount: true } });
  const confirmedPaid = await db.payment.aggregate({
    where: { invoice: { status: "CONFIRMED" } },
    _sum: { amount: true },
  });
  const confirmed = byStatus.find((s) => s.status === "CONFIRMED")?._sum.total ?? 0;
  const overdue = await db.invoice.aggregate({
    where: { status: "CONFIRMED", dueDate: { lt: now } },
    _count: true,
    _sum: { total: true },
  });
  const ms = Math.round(performance.now() - started);

  heading(label);
  out(`Active subscriptions : ${active.length}`);
  out(`MRR (normalised)     : ${formatINR(Math.round(mrr))}   ARR: ${formatINR(Math.round(mrr * 12))}`);
  out(`Payments received    : ${formatINR(received._sum.amount ?? 0)}`);
  out(`Outstanding          : ${formatINR(confirmed - (confirmedPaid._sum.amount ?? 0))}`);
  out(`Overdue invoices     : ${overdue._count} (${formatINR(overdue._sum.total ?? 0)} billed)`);
  out(`Invoices by status   : ${byStatus.map((s) => `${s.status} ${s._count}`).join(", ")}`);
  out(`(dashboard queries answered in ${ms} ms)`);
}

async function duplicatePeriods(): Promise<number> {
  const rows = await db.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*) AS c FROM (
      SELECT 1 FROM "Invoice" GROUP BY "subscriptionId", "periodStart" HAVING COUNT(*) > 1
    )`;
  return Number(rows[0]?.c ?? 0);
}

async function main(): Promise<void> {
  out(`Billing-day demo (${live ? "LIVE database" : "throwaway copy"}), billing date ${asOf.toISOString().slice(0, 10)}`);
  await snapshot("1. Before billing day");

  const due = await db.subscription.count({
    where: { status: "ACTIVE", nextInvoiceDate: { lte: asOf } },
  });
  heading("2. Billing day");
  out(`${due} subscriptions are due. Nobody types an invoice by hand; running the billing engine...`);
  const started = performance.now();
  const run = await runBilling(asOf, db);
  out(`Created ${run.invoicesCreated} invoices in ${Math.round(performance.now() - started)} ms`);
  out("(includes catch-up periods for daily and weekly plans)");
  out(`Subscriptions closed automatically at plan end: ${run.subscriptionsClosed}`);
  out(`Errors: ${run.errors.length}`);

  const sample = await db.invoice.findFirst({
    where: { id: { in: run.invoiceIds }, discountTotal: { gt: 0 } },
    include: { lines: true, customer: { select: { name: true } } },
  });
  if (sample) {
    heading("3. A generated invoice (discount and tax applied automatically)");
    out(`${sample.number} for ${sample.customer.name}, due ${sample.dueDate.toISOString().slice(0, 10)}`);
    for (const l of sample.lines) {
      out(`  ${l.description}  qty ${l.quantity} x ${formatINR(l.unitPrice)}  discount -${formatINR(l.discountAmount)}  tax ${formatINR(l.taxAmount)}`);
    }
    out(`  Subtotal ${formatINR(sample.subtotal)}  Discount -${formatINR(sample.discountTotal)}  Tax ${formatINR(sample.taxTotal)}  TOTAL ${formatINR(sample.total)}`);
  }

  heading("4. Run it again: nothing is billed twice or skipped");
  const again = await runBilling(asOf, db);
  out(`Second run created ${again.invoicesCreated} invoices (due: ${again.due}).`);
  out(`Duplicate subscription periods in the database: ${await duplicatePeriods()}`);

  await snapshot("5. After billing day");
  if (!live) out("\nRehearsal only: the real database was not changed. Use --live for the recording.");
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

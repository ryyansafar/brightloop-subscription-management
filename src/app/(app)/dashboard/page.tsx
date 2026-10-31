// Owner: fathima. Dashboard: KPI tiles with date range and plan filters (GET form, so it is shareable).
import type { Metadata } from "next";
import { connection } from "next/server";
import { Button, Input, PageHeader, Select, StatCard, param, type Params } from "@/components";
import { rupees } from "@/lib/money";
import { getDashboardSummary, getPlanOptions } from "./queries";

export const metadata: Metadata = { title: "Dashboard" };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// KPI tiles show whole rupees; exact paise are on the invoices.
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const formatINR = (paise: number) => inr.format(rupees(paise));

function readFilters(params: Params, today: Date) {
  const defaultFrom = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth() + 1, 1));
  const from = new Date(param(params, "from") ?? ymd(defaultFrom));
  const toInput = new Date(param(params, "to") ?? ymd(today));
  const planId = Number(param(params, "plan")) || undefined;
  const valid = !Number.isNaN(from.getTime()) && !Number.isNaN(toInput.getTime());
  return {
    from: valid ? from : defaultFrom,
    toInput: valid ? toInput : today,
    // "to" is inclusive in the form, exclusive in the queries.
    to: new Date((valid ? toInput : today).getTime() + 86_400_000),
    planId,
    today,
  };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection(); // live numbers: render per request, never prerender
  const f = readFilters(await searchParams, new Date());
  const [s, plans] = await Promise.all([getDashboardSummary(f), getPlanOptions()]);
  const n = (v: number) => v.toLocaleString("en-IN");

  return (
    <>
      <PageHeader title="Dashboard" description="Subscriptions and revenue at a glance" />

      <div className="flex flex-col gap-6 p-4 md:p-6">
        <form className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            From
            <Input type="date" name="from" defaultValue={ymd(f.from)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            To
            <Input type="date" name="to" defaultValue={ymd(f.toInput)} />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:min-w-48">
            Plan
            <Select name="plan" defaultValue={f.planId ?? ""}>
              <option value="">All plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="primary">
            Apply
          </Button>
        </form>

        <section aria-label="Recurring revenue" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active subscriptions" value={n(s.activeSubscriptions)} tone="primary" href="/subscriptions?status=ACTIVE" />
          <StatCard label="MRR" value={formatINR(s.mrr)} hint="Monthly recurring revenue, before tax" />
          <StatCard label="ARR" value={formatINR(s.arr)} hint="MRR × 12" />
          <StatCard label="Churned" value={n(s.churned)} hint="Closed in this period" tone={s.churned ? "warning" : "neutral"} />
        </section>

        <section aria-label="Billing" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Revenue" value={formatINR(s.revenue)} hint="Confirmed and paid invoices" />
          <StatCard label="Payments received" value={formatINR(s.paymentsReceived)} tone="success" href="/payments" />
          <StatCard label="Outstanding" value={formatINR(s.outstanding)} hint="Unpaid balance, today" tone="warning" href="/invoices?filter=outstanding" />
          <StatCard
            label="Overdue invoices"
            value={n(s.overdueCount)}
            hint={`${formatINR(s.overdueAmount)} past due`}
            tone={s.overdueCount ? "danger" : "neutral"}
            href="/invoices?filter=overdue"
          />
        </section>
      </div>
    </>
  );
}

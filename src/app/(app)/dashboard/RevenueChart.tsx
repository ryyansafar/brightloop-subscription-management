"use client";
// Owner: fathima. Billed vs collected per month (formatters live here: functions can't cross from the server page).
import { ColumnChart } from "@/components/charts/ColumnChart";
import { formatINR, rupees } from "@/lib/money";
import type { MonthPoint } from "./queries";

const compact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});
const short = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
const long = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export function RevenueChart({ points }: { points: MonthPoint[] }) {
  if (points.every((p) => p.revenue === 0 && p.payments === 0)) {
    return (
      <section className="rounded-lg border border-line bg-surface p-6 text-center" aria-label="Billed vs collected, by month">
        <h2 className="text-sm font-semibold">Billed vs collected, by month</h2>
        <p className="mt-2 text-sm text-muted">No invoices or payments in this date range. Try widening the dates or choosing all plans.</p>
      </section>
    );
  }
  const data = points.map((p) => {
    const date = new Date(`${p.month}-01T00:00:00Z`);
    return { label: short.format(date), title: long.format(date), values: [p.revenue, p.payments] };
  });
  return (
    <ColumnChart
      title="Billed vs collected, by month"
      series={[{ name: "Billed" }, { name: "Collected" }]}
      data={data}
      formatValue={formatINR}
      formatTick={(v) => compact.format(rupees(v))}
    />
  );
}

// Side panel: recurring amount and the invoices generated for this subscription.
import Link from "next/link";
import { StatusBadge, formatDate } from "@/components";
import { formatINR } from "@/lib/money";
import { periodLabel } from "../labels";
import type { SubscriptionDetail } from "../detail";

export function SidePanel({ data, today }: { data: SubscriptionDetail; today: Date }) {
  const { sub, totals } = data;
  const shown = (inv: { status: string; dueDate: Date }) =>
    inv.status === "CONFIRMED" && inv.dueDate < today ? "OVERDUE" : inv.status;

  return (
    <aside className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-surface p-4" aria-label="Recurring amount">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Recurring amount</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{formatINR(totals.total)}</p>
        <p className="mt-1 text-xs text-muted">
          per {periodLabel(sub.plan.periodUnit, sub.plan.periodCount)}, tax included
        </p>
      </section>

      <section className="rounded-lg border border-line bg-surface" aria-labelledby="inv-h">
        <h2 id="inv-h" className="border-b border-line px-4 py-3 text-sm font-semibold">Invoices</h2>
        {sub.invoices.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No invoices yet</p>
        ) : (
          <ul className="divide-y divide-line">
            {sub.invoices.map((inv) => (
              <li key={inv.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/invoices/${inv.id}`} className="block min-h-6 truncate text-sm font-medium text-primary hover:underline">
                    {inv.number}
                  </Link>
                  <p className="text-xs text-muted tabular-nums">
                    Due {formatDate(inv.dueDate)} · {formatINR(inv.total)}
                  </p>
                </div>
                <StatusBadge status={shown(inv)} />
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
          {sub.invoices.length} {sub.invoices.length === 1 ? "invoice" : "invoices"} generated
          {sub.status === "ACTIVE" && sub.nextInvoiceDate && <> · next on {formatDate(sub.nextInvoiceDate)}</>}
        </p>
      </section>
    </aside>
  );
}

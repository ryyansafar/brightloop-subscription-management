// Read-only cards of the subscription form view: details and order lines with totals.
import { formatDate } from "@/components";
import { formatINR } from "@/lib/money";
import { Totals } from "../Totals";
import { percentLabel, planOptionLabel } from "../labels";
import type { SubscriptionDetail } from "../detail";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

export function DetailsCard({ data }: { data: SubscriptionDetail }) {
  const { sub } = data;
  return (
    <section className="rounded-lg border border-line bg-surface" aria-labelledby="details-h">
      <h2 id="details-h" className="border-b border-line px-4 py-3 text-sm font-semibold">Subscription details</h2>
      <dl className="grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Customer">
          <span className="font-medium">{sub.customer.name}</span>
          {sub.customer.company && <span className="block text-muted">{sub.customer.company}</span>}
          <span className="block text-muted">{sub.customer.email}</span>
        </Field>
        <Field label="Plan">{planOptionLabel(sub.plan)}</Field>
        <Field label="Start date">{formatDate(sub.startDate)}</Field>
        <Field label="Expiry date">{formatDate(sub.endDate)}</Field>
        <Field label="Payment terms">{sub.paymentTermDays === 0 ? "Due on receipt" : `Net ${sub.paymentTermDays} days`}</Field>
        <Field label="Next invoice">{formatDate(sub.nextInvoiceDate)}</Field>
        {sub.status === "PAUSED" && sub.pausedAt && <Field label="Paused since">{formatDate(sub.pausedAt)}</Field>}
        {sub.closeReason && <Field label="Close reason">{sub.closeReason}</Field>}
      </dl>
    </section>
  );
}

export function LinesCard({ data }: { data: SubscriptionDetail }) {
  const { lines, totals } = data;
  return (
    <section className="rounded-lg border border-line bg-surface" aria-labelledby="lines-h">
      <h2 id="lines-h" className="border-b border-line px-4 py-3 text-sm font-semibold">Order lines</h2>
      {lines.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">This subscription has no lines.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Product</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Qty</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Unit price</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Tax</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="px-4 py-2.5">{l.description}</td>
                  <td className="px-4 py-2.5 text-right">{l.quantity}</td>
                  <td className="px-4 py-2.5 text-right">{formatINR(l.unitPrice)}</td>
                  <td className="px-4 py-2.5 text-right">{l.taxBps ? percentLabel(l.taxBps) : "—"}</td>
                  <td className="px-4 py-2.5 text-right">{formatINR(l.quantity * l.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Totals {...totals} note="As the next invoice will be calculated, with the discounts valid on its date." />
    </section>
  );
}

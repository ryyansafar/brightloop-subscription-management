// Owner: fathima. The invoice itself, laid out to print cleanly on A4 (chrome is hidden with .no-print).
import { formatDate, formatPeriod } from "@/components";
import { formatINR } from "@/lib/money";
import type { InvoiceDetail } from "../queries";

const percent = (bps: number) => `${(bps / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-6 py-1 ${strong ? "border-t border-line pt-2 font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function InvoiceDocument({ invoice }: { invoice: InvoiceDetail }) {
  const c = invoice.customer;
  return (
    <article className="rounded-lg border border-line bg-surface p-5 text-sm md:p-8 print:border-0 print:p-0">
      <header className="flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div>
          <p className="text-lg font-semibold">Brightloop Software</p>
          <p className="text-muted">Subscription services</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xl font-semibold">Invoice {invoice.number}</p>
          {invoice.status === "DRAFT" && <p className="font-medium text-warning">Draft</p>}
          {invoice.status === "CANCELLED" && <p className="font-medium text-danger">Cancelled</p>}
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bill to</p>
          <p className="mt-1 font-medium">{c.name}</p>
          {c.company && <p>{c.company}</p>}
          {c.address && <p className="whitespace-pre-line">{c.address}</p>}
          <p className="text-muted">{c.email}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:justify-self-end">
          <dt className="text-muted">Invoice date</dt>
          <dd>{formatDate(invoice.periodStart)}</dd>
          <dt className="text-muted">Due date</dt>
          <dd>{formatDate(invoice.dueDate)}</dd>
          <dt className="text-muted">Period</dt>
          <dd>{formatPeriod(invoice.periodStart, invoice.periodEnd)}</dd>
        </dl>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="py-2 text-left font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit price</th>
              <th className="py-2 text-right font-medium">Discount</th>
              <th className="py-2 text-right font-medium">Tax</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {invoice.lines.map((l) => (
              <tr key={l.id} className="border-b border-line">
                <td className="py-2 pr-4">{l.description}</td>
                <td className="py-2 text-right">{l.quantity}</td>
                <td className="py-2 text-right">{formatINR(l.unitPrice)}</td>
                <td className="py-2 text-right">{l.discountAmount ? `−${formatINR(l.discountAmount)}` : "—"}</td>
                <td className="py-2 text-right">{l.taxBps ? percent(l.taxBps) : "—"}</td>
                <td className="py-2 text-right">{formatINR(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 ml-auto w-full max-w-xs">
        <Row label="Subtotal" value={formatINR(invoice.subtotal)} />
        {invoice.discountTotal > 0 && <Row label="Discount" value={`−${formatINR(invoice.discountTotal)}`} />}
        <Row label="Tax" value={formatINR(invoice.taxTotal)} />
        <Row label="Total" value={formatINR(invoice.total)} strong />
        {invoice.paid > 0 && <Row label="Paid" value={`−${formatINR(invoice.paid)}`} />}
        {invoice.status !== "CANCELLED" && invoice.status !== "DRAFT" && (
          <Row label="Amount due" value={formatINR(invoice.balance)} strong />
        )}
      </dl>
    </article>
  );
}

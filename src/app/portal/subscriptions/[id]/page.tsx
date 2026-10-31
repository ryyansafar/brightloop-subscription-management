import { Suspense } from "react";
// Read-only subscription detail for the signed-in customer: terms, lines and invoices.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, StatusBadge, formatDate } from "@/components";
import { formatINR } from "@/lib/money";
import { InvoiceTable } from "../../InvoiceTable";
import { closeBlockedReason, periodLabel, recurringAmount, renewBlockedReason } from "../../logic";
import { NoAccount } from "../../NoAccount";
import { getPortalSubscription } from "../../queries";
import { getPortalScope } from "../../scope";
import { SubscriptionActions } from "../../SubscriptionActions";

export const metadata: Metadata = { title: "Subscription" };

async function PortalSubscriptionPageContent({ params }: { params: Promise<{ id: string }> }) {
  const scope = await getPortalScope();
  if (!scope.linked) return <NoAccount name={scope.displayName} />;
  const id = Number((await params).id);
  const sub = Number.isInteger(id) && id > 0 ? await getPortalSubscription(scope.customerId, id) : null;
  if (!sub) notFound();

  const facts: [string, string][] = [
    ["Plan", sub.plan.name],
    ["Billing", `${formatINR(recurringAmount(sub.lines))} ${periodLabel(sub.plan.periodUnit, sub.plan.periodCount)}`],
    ["Started", formatDate(sub.startDate)],
    ["Term ends", formatDate(sub.endDate)],
    ["Next invoice", formatDate(sub.status === "ACTIVE" ? sub.nextInvoiceDate : null)],
    ["Payment terms", `${sub.paymentTermDays} days`],
  ];

  return (
    <>
      <PageHeader
        title={sub.number}
        breadcrumbs={[{ label: "My subscriptions", href: "/portal" }]}
        actions={
          <>
            <StatusBadge status={sub.status} />
            <SubscriptionActions
              id={sub.id}
              number={sub.number}
              planName={sub.plan.name}
              renewBlocked={renewBlockedReason(sub)}
              closeBlocked={closeBlockedReason(sub)}
            />
          </>
        }
      />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <dl className="grid gap-4 rounded-lg border border-line bg-surface p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="break-words font-medium">{value}</dd>
            </div>
          ))}
          {sub.status === "CLOSED" && sub.closeReason && (
            <div className="min-w-0 sm:col-span-2 lg:col-span-3">
              <dt className="text-xs text-muted">Reason for closing</dt>
              <dd className="break-words font-medium">{sub.closeReason}</dd>
            </div>
          )}
        </dl>

        <section aria-labelledby="lines-heading" className="rounded-lg border border-line bg-surface">
          <h2 id="lines-heading" className="border-b border-line px-4 py-3 text-sm font-semibold">
            What is included
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">Item</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th scope="col" className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Unit price</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {sub.lines.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className="break-words px-4 py-2.5">{l.productName}</td>
                    <td className="px-4 py-2.5 text-right">{l.quantity}</td>
                    <td className="hidden px-4 py-2.5 text-right md:table-cell">{formatINR(l.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-right">{formatINR(l.quantity * l.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="sub-inv-heading" className="flex flex-col gap-3">
          <h2 id="sub-inv-heading" className="text-base font-semibold">
            Invoices
          </h2>
          <InvoiceTable rows={sub.invoices} today={scope.today} emptyMessage="No invoices for this subscription yet." />
        </section>
      </div>
    </>
  );
}

export default function PortalSubscriptionPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div role="status" className="p-6 text-muted">Loading…</div>}><PortalSubscriptionPageContent {...props} /></Suspense>;
}

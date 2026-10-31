// Owner: fathima. Invoice form view: status bar with actions, the printable document, and payments.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, StatusBar, formatDate } from "@/components";
import { formatINR } from "@/lib/money";
import { displayStatus, getInvoice } from "../queries";
import { InvoiceActions } from "./InvoiceActions";
import { InvoiceDocument } from "./InvoiceDocument";
import { invoiceStepLabels } from "../status-labels";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  const invoice = Number.isInteger(id) && id > 0 ? await getInvoice(id) : null;
  if (!invoice) notFound();
  const today = new Date();
  const shown = displayStatus(invoice, today);

  return (
    <>
      <PageHeader title={invoice.number} breadcrumbs={[{ label: "Invoices", href: "/invoices" }]} />
      <StatusBar
        steps={["DRAFT", "CONFIRMED", "PAID"]}
        current={invoice.status}
        labels={invoiceStepLabels(shown)}
        actions={
          <InvoiceActions
            id={invoice.id}
            number={invoice.number}
            status={invoice.status}
            balance={invoice.balance}
            hasPayments={invoice.payments.length > 0}
            sentAt={invoice.sentAt?.toISOString() ?? null}
          />
        }
      />

      <div className="flex flex-col gap-6 p-4 md:p-6 print:p-0">
        <InvoiceDocument invoice={invoice} />

        <section className="no-print rounded-lg border border-line bg-surface">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Payments</h2>
          {invoice.payments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span>
                    {formatDate(p.paidOn)} · {p.method.replaceAll("_", " ").toLowerCase()}
                    {p.note && <span className="text-muted"> · {p.note}</span>}
                  </span>
                  <span className="font-medium tabular-nums text-success">{formatINR(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="no-print text-sm text-muted">
          Subscription{" "}
          <Link href={`/subscriptions/${invoice.subscription.id}`} className="text-primary hover:underline">
            {invoice.subscription.number}
          </Link>{" "}
          · {invoice.subscription.plan.name}
          {invoice.sentAt && <> · Sent {formatDate(invoice.sentAt)}</>}
        </p>
      </div>
    </>
  );
}

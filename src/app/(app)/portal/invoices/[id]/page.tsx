// Read-only invoice document for the signed-in customer. Another customer's id is a plain 404.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatusBadge, formatDate, param, type Params } from "@/components";
import { formatINR } from "@/lib/money";
import { InvoiceDocument } from "../../../invoices/[id]/InvoiceDocument";
import { AutoPrint } from "../../AutoPrint";
import { invoiceDisplayStatus } from "../../logic";
import { NoAccount } from "../../NoAccount";
import { PrintButton } from "../../PrintButton";
import { getPortalInvoice } from "../../queries";
import { getPortalScope } from "../../scope";

export const metadata: Metadata = { title: "Invoice" };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}

export default async function PortalInvoicePage({ params, searchParams }: PageProps) {
  const scope = await getPortalScope();
  if (!scope.linked) return <NoAccount name={scope.displayName} />;
  const id = Number((await params).id);
  const invoice = Number.isInteger(id) && id > 0 ? await getPortalInvoice(scope.customerId, id) : null;
  if (!invoice) notFound();
  const autoPrint = param(await searchParams, "print") === "1";
  const status = invoiceDisplayStatus(invoice, scope.today);

  return (
    <>
      {autoPrint && <AutoPrint />}
      <PageHeader
        title={invoice.number}
        breadcrumbs={[{ label: "My invoices", href: "/portal/invoices" }]}
        actions={
          <>
            <StatusBadge status={status} />
            <PrintButton />
          </>
        }
      />
      <div className="flex flex-col gap-6 p-4 md:p-6 print:p-0">
        <InvoiceDocument invoice={invoice} />
        {invoice.payments.length > 0 && (
          <section className="no-print rounded-lg border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Payments received</h2>
            <ul className="divide-y divide-line text-sm">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span>
                    {formatDate(p.paidOn)} · {p.method.replaceAll("_", " ").toLowerCase()}
                  </span>
                  <span className="font-medium tabular-nums text-success">
                    {formatINR(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="no-print text-sm text-muted">
          Subscription{" "}
          <Link href={`/portal/subscriptions/${invoice.subscription.id}`} className="text-primary hover:underline">
            {invoice.subscription.number}
          </Link>{" "}
          · {invoice.subscription.plan.name}
        </p>
      </div>
    </>
  );
}

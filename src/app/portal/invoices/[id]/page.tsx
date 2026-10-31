import type { Metadata } from "next";
import { Suspense } from "react";
import { PagePending } from "@/lib/auth/ui/PagePending";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatusBadge, formatDate } from "@/components";
import { formatINR } from "@/lib/money";
import { InvoiceDocument } from "@/app/(app)/invoices/[id]/InvoiceDocument";
import { portalInvoiceDetail } from "../../queries";
import { PrintButton } from "../PrintButton";

export const metadata: Metadata = { title: "My invoice" };
async function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const invoice = Number.isSafeInteger(id) && id > 0 ? await portalInvoiceDetail(id) : null;
  if (!invoice) notFound();
  return <><PageHeader title={invoice.number} breadcrumbs={[{ label: "My invoices", href: "/portal/invoices" }]} actions={<PrintButton />} /><div className="space-y-6 p-4 md:p-6 print:p-0">
    <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5"><StatusBadge status={invoice.status === "CONFIRMED" && invoice.dueDate < new Date() ? "OVERDUE" : invoice.status} /><p className="text-sm">{invoice.status === "CONFIRMED" ? <>Amount due <span className="ml-2 font-semibold tabular-nums">{formatINR(invoice.balance)}</span></> : invoice.status === "PAID" ? "This invoice is fully paid." : invoice.status === "DRAFT" ? "This invoice is a draft." : "This invoice has been cancelled."}</p></div>
    <InvoiceDocument invoice={invoice} />
    <section className="no-print rounded-xl border border-line bg-surface"><h2 className="border-b border-line px-5 py-4 font-semibold">Payment history</h2>{invoice.payments.length ? <ul className="divide-y divide-line">{invoice.payments.map((payment) => <li key={payment.id} className="flex flex-wrap justify-between gap-3 px-5 py-4 text-sm"><span>{formatDate(payment.paidOn)} · {payment.method.replaceAll("_", " ")}</span><span className="font-medium tabular-nums text-success">{formatINR(payment.amount)}</span></li>)}</ul> : <p className="p-5 text-sm text-muted">No payments have been recorded for this invoice.</p>}</section>
    <p className="no-print text-sm text-muted">For billing questions, contact your account manager. <Link href={`/portal/subscriptions/${invoice.subscription.id}`} className="font-medium text-primary hover:underline">View subscription {invoice.subscription.number}</Link></p>
  </div></>;
}
export default function Page(props: { params: Promise<{ id: string }> }) { return <Suspense fallback={<PagePending />}><PortalInvoicePage {...props} /></Suspense>; }

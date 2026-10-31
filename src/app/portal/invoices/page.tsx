import type { Metadata } from "next";
import { Suspense } from "react";
import { PagePending } from "@/lib/auth/ui/PagePending";
import { DataTable, PageHeader, StatusBadge, formatDate, formatPeriod, param, pageParam, type Params, type Column } from "@/components";
import { formatINR } from "@/lib/money";
import { portalInvoices, PAGE_SIZE } from "../queries";

export const metadata: Metadata = { title: "My invoices" };
async function PortalInvoicesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const data = await portalInvoices({ status: param(params, "status"), q: param(params, "q"), page: pageParam(params) });
  const today = new Date();
  type Row = (typeof data.rows)[number];
  const columns: Column<Row>[] = [
    { key: "number", header: "Invoice" }, { key: "subscription", header: "Subscription", hideOnMobile: true, render: (row) => row.subscription.number },
    { key: "period", header: "Period", hideOnMobile: true, render: (row) => formatPeriod(row.periodStart, row.periodEnd) },
    { key: "due", header: "Due", hideOnMobile: true, render: (row) => formatDate(row.dueDate) },
    { key: "total", header: "Total", align: "right", render: (row) => formatINR(row.total) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status === "CONFIRMED" && row.dueDate < today ? "OVERDUE" : row.status} /> },
  ];
  return <><PageHeader title="My invoices" description="A clear record of your billing and payments." /><div className="p-4 md:p-6"><DataTable columns={columns} rows={data.rows} rowKey={(row) => row.id} rowHref={(row) => `/portal/invoices/${row.id}`} basePath="/portal/invoices" searchParams={params} search={{ placeholder: "Search invoice number" }}
    filters={[{ param: "status", options: [{ label: "Outstanding", value: "CONFIRMED" }, { label: "Overdue", value: "OVERDUE" }, { label: "Paid", value: "PAID" }, { label: "Draft", value: "DRAFT" }, { label: "Cancelled", value: "CANCELLED" }] }]} pagination={{ page: data.page, pageSize: PAGE_SIZE, total: data.total }} emptyMessage="No invoices match these filters." /></div></>;
}
export default function Page(props: { searchParams: Promise<Params> }) { return <Suspense fallback={<PagePending />}><PortalInvoicesPage {...props} /></Suspense>; }

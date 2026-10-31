// Owner: fathima. Invoice list view with paid / outstanding / overdue filters and search.
import type { Metadata } from "next";
import { connection } from "next/server";
import {
  DataTable,
  MobileMeta,
  PageHeader,
  StatusBadge,
  formatDate,
  formatPeriod,
  pageParam,
  param,
  type Column,
  type Params,
} from "@/components";
import { formatINR } from "@/lib/money";
import { PAGE_SIZE, displayStatus, isInvoiceFilter, listInvoices, type InvoiceRow } from "./queries";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const params = await searchParams;
  const today = new Date();
  const filter = param(params, "filter");
  const page = pageParam(params);
  const { rows, total } = await listInvoices({
    filter: isInvoiceFilter(filter) ? filter : undefined,
    q: param(params, "q"),
    page,
    today,
  });

  const columns: Column<InvoiceRow>[] = [
    { key: "number", header: "Number" },
    { key: "customer", header: "Customer", render: (r) => r.customer.name },
    {
      key: "period",
      header: "Period",
      hideBelow: "xl",
      render: (r) => formatPeriod(r.periodStart, r.periodEnd),
    },
    { key: "dueDate", header: "Due", hideBelow: "lg", render: (r) => formatDate(r.dueDate) },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (r) => (
        <>
          {formatINR(r.total)}
          <span className="mt-1 block md:hidden">
            <StatusBadge status={displayStatus(r, today)} />
          </span>
        </>
      ),
    },
    {
      key: "balance",
      header: "Amount due",
      align: "right",
      hideBelow: "lg",
      render: (r) => (r.status === "CONFIRMED" ? formatINR(r.balance) : "—"),
    },
    { key: "status", header: "Status", hideOnMobile: true, render: (r) => <StatusBadge status={displayStatus(r, today)} /> },
  ];

  return (
    <>
      <PageHeader title="Invoices" description={`${total.toLocaleString("en-IN")} invoices`} />
      <div className="p-4 md:p-6">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/invoices/${r.id}`}
          basePath="/invoices"
          searchParams={params}
          filters={[
            {
              param: "filter",
              options: [
                { label: "Draft", value: "draft" },
                { label: "Outstanding", value: "outstanding" },
                { label: "Overdue", value: "overdue" },
                { label: "Paid", value: "paid" },
                { label: "Cancelled", value: "cancelled" },
              ],
            },
          ]}
          search={{ placeholder: "Invoice number or customer" }}
          pagination={{ page, pageSize: PAGE_SIZE, total }}
          emptyMessage="No invoices match these filters."
        />
      </div>
    </>
  );
}

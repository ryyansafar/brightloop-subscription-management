// The customer's invoice list: used in full on /portal/invoices and as the "recent" table on /portal.
import Link from "next/link";
import {
  Button,
  DataTable,
  StatusBadge,
  formatDate,
  type Column,
  type FilterGroup,
  type Params,
} from "@/components";
import { formatINR } from "@/lib/money";
import { invoiceDisplayStatus } from "./logic";
import type { PortalInvoiceRow } from "./queries";

interface InvoiceTableProps {
  rows: PortalInvoiceRow[];
  today: Date;
  basePath?: string;
  searchParams?: Params;
  filters?: FilterGroup[];
  search?: { placeholder?: string };
  pagination?: { page: number; pageSize: number; total: number };
  emptyMessage?: string;
}

/**
 * The shared table toolbar and pager use small targets; on this customer-facing list every control is at
 * least 40px tall (chips, search, pager) without changing the shared components.
 */
const TOUCH_TARGETS = [
  "[&_.flex-wrap>a]:inline-flex [&_.flex-wrap>a]:min-h-10 [&_.flex-wrap>a]:items-center",
  "[&_input[type=search]]:h-11 [&_form_button]:h-11",
  "[&_.gap-1>a]:inline-flex [&_.gap-1>a]:size-10 [&_.gap-1>a]:items-center [&_.gap-1>a]:justify-center",
  "[&_.gap-1>span]:inline-flex [&_.gap-1>span]:size-10 [&_.gap-1>span]:items-center [&_.gap-1>span]:justify-center",
].join(" ");

export function InvoiceTable({
  rows,
  today,
  basePath = "/portal/invoices",
  searchParams,
  filters,
  search,
  pagination,
  emptyMessage = "You have no invoices yet.",
}: InvoiceTableProps) {
  const columns: Column<PortalInvoiceRow>[] = [
    {
      key: "number",
      header: "Number",
      render: (r) => (
        <Link
          href={`/portal/invoices/${r.id}`}
          className="inline-flex min-h-11 items-center font-medium text-primary hover:underline md:min-h-0"
        >
          {r.number}
        </Link>
      ),
    },
    {
      key: "date",
      header: "Date",
      hideOnMobile: true,
      render: (r) => formatDate(r.periodStart),
    },
    {
      key: "due",
      header: "Due",
      hideOnMobile: true,
      render: (r) => formatDate(r.dueDate),
    },
    {
      key: "total",
      header: "Amount",
      align: "right",
      render: (r) => formatINR(r.total),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={invoiceDisplayStatus(r, today)} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      hideOnMobile: true,
      render: (r) => (
        <span className="flex justify-end gap-2">
          <Button
            href={`/portal/invoices/${r.id}`}
            variant="primary"
            size="sm"
            className="min-h-11 md:min-h-8"
          >
            View<span className="sr-only"> invoice {r.number}</span>
          </Button>
          <Button
            href={`/portal/invoices/${r.id}?print=1`}
            size="sm"
            className="min-h-11 md:min-h-8"
          >
            Print<span className="sr-only"> invoice {r.number}</span>
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className={TOUCH_TARGETS}>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        basePath={basePath}
        searchParams={searchParams}
        filters={filters}
        search={search}
        pagination={pagination}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}

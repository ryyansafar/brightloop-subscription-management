// Owner: fathima. Payments list view: filter by method, search by invoice or customer.
import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { DataTable, MobileMeta, PageHeader, formatDate, pageParam, param, type Column, type Params } from "@/components";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { getSessionUser } from "@/lib/auth/session";
import { PAYMENT_METHODS } from "@/lib/state";
import { DateRangeFilter } from "./DateRangeFilter";
import { readDateRange, type DateRange } from "./filters";
import { paymentMethodLabel } from "./methods";
import { RecordPaymentButton } from "./RecordPaymentButton";

export const metadata: Metadata = { title: "Payments" };

const PAGE_SIZE = 20;

async function listPayments(method: string | undefined, q: string | undefined, range: DateRange, page: number) {
  const where: Prisma.PaymentWhereInput = {
    ...(range.from || range.toExclusive
      ? { paidOn: { ...(range.from ? { gte: range.from } : {}), ...(range.toExclusive ? { lt: range.toExclusive } : {}) } }
      : {}),
    ...(method && (PAYMENT_METHODS as readonly string[]).includes(method) ? { method } : {}),
    ...(q
      ? { invoice: { OR: [{ number: { contains: q } }, { customer: { name: { contains: q } } }] } }
      : {}),
  };
  const [rows, total, sum] = await Promise.all([
    db.payment.findMany({
      where,
      include: { invoice: { select: { id: true, number: true, customer: { select: { name: true } } } } },
      orderBy: [{ paidOn: "desc" }, { id: "desc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.payment.count({ where }),
    db.payment.aggregate({ where, _sum: { amount: true } }),
  ]);
  return { rows, total, amount: sum._sum.amount ?? 0 };
}

type PaymentRow = Awaited<ReturnType<typeof listPayments>>["rows"][number];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const params = await searchParams;
  const page = pageParam(params);
  const range = readDateRange(params);
  const { rows, total, amount } = await listPayments(param(params, "method"), param(params, "q")?.trim(), range, page);
  const user = await getSessionUser(new Request("http://app.local", { headers: { cookie: (await cookies()).toString() } }));
  const canRecord = user?.role === "ADMIN" || user?.role === "STAFF";

  const columns: Column<PaymentRow>[] = [
    { key: "paidOn", header: "Date", render: (r) => formatDate(r.paidOn) },
    {
      key: "invoice",
      header: "Invoice",
      render: (r) => (
        <>
          <Link href={`/invoices/${r.invoice.id}`} className="inline-flex min-h-10 items-center text-primary hover:underline md:min-h-0">
            {r.invoice.number}
          </Link>
          <MobileMeta>{r.invoice.customer.name}</MobileMeta>
        </>
      ),
    },
    { key: "customer", header: "Customer", hideOnMobile: true, render: (r) => r.invoice.customer.name },
    { key: "method", header: "Method", hideOnMobile: true, render: (r) => paymentMethodLabel(r.method) },
    { key: "note", header: "Note", hideBelow: "xl", render: (r) => <span className="text-muted">{r.note ?? "—"}</span> },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (r) => (
        <>
          {formatINR(r.amount)}
          <MobileMeta>{paymentMethodLabel(r.method)}</MobileMeta>
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        description={`${total.toLocaleString("en-IN")} payments · ${formatINR(amount)} received`}
        actions={canRecord && <RecordPaymentButton />}
      />
      <div className="p-4 md:p-6">
        <DateRangeFilter
          basePath="/payments"
          searchParams={params}
          from={range.fromInput}
          to={range.toInput}
          error={range.reversed ? "The end date is before the start date, so no date filter is applied." : undefined}
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          basePath="/payments"
          searchParams={params}
          filters={[
            { param: "method", options: PAYMENT_METHODS.map((m) => ({ label: paymentMethodLabel(m), value: m })) },
          ]}
          search={{ placeholder: "Invoice number or customer" }}
          pagination={{ page, pageSize: PAGE_SIZE, total }}
          emptyMessage="No payments match these filters."
        />
      </div>
    </>
  );
}

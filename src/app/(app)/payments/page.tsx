// Owner: fathima. Payments list view: filter by method, search by invoice or customer.
import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { DataTable, PageHeader, formatDate, humanize, pageParam, param, type Column, type Params } from "@/components";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/state";

export const metadata: Metadata = { title: "Payments" };

const PAGE_SIZE = 20;

async function listPayments(method: string | undefined, q: string | undefined, page: number) {
  const where: Prisma.PaymentWhereInput = {
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
  const { rows, total, amount } = await listPayments(param(params, "method"), param(params, "q")?.trim(), page);

  const columns: Column<PaymentRow>[] = [
    { key: "paidOn", header: "Date", render: (r) => formatDate(r.paidOn) },
    {
      key: "invoice",
      header: "Invoice",
      render: (r) => (
        <Link href={`/invoices/${r.invoice.id}`} className="text-primary hover:underline">
          {r.invoice.number}
        </Link>
      ),
    },
    { key: "customer", header: "Customer", hideOnMobile: true, render: (r) => r.invoice.customer.name },
    { key: "method", header: "Method", hideOnMobile: true, render: (r) => humanize(r.method) },
    { key: "note", header: "Note", hideOnMobile: true, render: (r) => r.note ?? "" },
    { key: "amount", header: "Amount", align: "right", render: (r) => formatINR(r.amount) },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        description={`${total.toLocaleString("en-IN")} payments · ${formatINR(amount)} received`}
      />
      <div className="p-4 md:p-6">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          basePath="/payments"
          searchParams={params}
          filters={[
            { param: "method", options: PAYMENT_METHODS.map((m) => ({ label: m === "UPI" ? "UPI" : humanize(m), value: m })) },
          ]}
          search={{ placeholder: "Invoice number or customer" }}
          pagination={{ page, pageSize: PAGE_SIZE, total }}
          emptyMessage="No payments match these filters."
        />
      </div>
    </>
  );
}

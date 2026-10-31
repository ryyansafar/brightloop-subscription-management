// Owner: fathima. Reads for the invoice list and form views. Actions go through Ryyan's API routes.
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { outstanding } from "@/lib/invoices";

export const INVOICE_FILTERS = ["draft", "outstanding", "overdue", "paid", "cancelled"] as const;
export type InvoiceFilter = (typeof INVOICE_FILTERS)[number];

export const PAGE_SIZE = 20;

/** Same definitions as the dashboard: outstanding = confirmed and unpaid, overdue = also past due. */
function filterWhere(filter: InvoiceFilter | undefined, today: Date): Prisma.InvoiceWhereInput {
  switch (filter) {
    case "draft":
      return { status: "DRAFT" };
    case "outstanding":
      return { status: "CONFIRMED" };
    case "overdue":
      return { status: "CONFIRMED", dueDate: { lt: today } };
    case "paid":
      return { status: "PAID" };
    case "cancelled":
      return { status: "CANCELLED" };
    default:
      return {};
  }
}

export function isInvoiceFilter(value: string | undefined): value is InvoiceFilter {
  return (INVOICE_FILTERS as readonly string[]).includes(value ?? "");
}

/** Status to show: a confirmed invoice past its due date shows as OVERDUE. */
export function displayStatus(invoice: { status: string; dueDate: Date }, today: Date): string {
  return invoice.status === "CONFIRMED" && invoice.dueDate < today ? "OVERDUE" : invoice.status;
}

export async function listInvoices(opts: { filter?: InvoiceFilter; q?: string; page: number; today: Date }) {
  const q = opts.q?.trim();
  const where: Prisma.InvoiceWhereInput = {
    ...filterWhere(opts.filter, opts.today),
    ...(q ? { OR: [{ number: { contains: q } }, { customer: { name: { contains: q } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.invoice.findMany({
      where,
      select: {
        id: true,
        number: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        dueDate: true,
        total: true,
        customer: { select: { name: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { id: "desc" },
      take: PAGE_SIZE,
      skip: (opts.page - 1) * PAGE_SIZE,
    }),
    db.invoice.count({ where }),
  ]);
  return {
    total,
    rows: rows.map(({ payments, ...row }) => ({ ...row, balance: outstanding({ total: row.total, payments }) })),
  };
}

export type InvoiceRow = Awaited<ReturnType<typeof listInvoices>>["rows"][number];

export async function getInvoice(id: number) {
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: { orderBy: { id: "asc" } },
      payments: { orderBy: { paidOn: "asc" } },
      subscription: { select: { id: true, number: true, plan: { select: { name: true } } } },
    },
  });
  if (!invoice) return null;
  const paid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  return { ...invoice, paid, balance: invoice.total - paid };
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;

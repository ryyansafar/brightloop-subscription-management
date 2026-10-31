// Customer-scoped reads. Every function takes the customer id resolved from the session (never from the
// URL) and puts it in the WHERE clause, so a guessed id from another customer simply finds nothing.
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { outstanding } from "@/lib/invoices";
import { summariseOverdue, type PortalFilter } from "./logic";

export const PORTAL_PAGE_SIZE = 10;
export const RECENT_INVOICES = 5;

/** Drafts are internal: a customer only sees invoices that have been issued. */
function invoiceScope(customerId: number): Prisma.InvoiceWhereInput {
  return { customerId, status: { not: "DRAFT" } };
}

function filterWhere(filter: PortalFilter | undefined, today: Date): Prisma.InvoiceWhereInput {
  switch (filter) {
    case "outstanding":
      return { status: "CONFIRMED" };
    case "overdue":
      return { status: "CONFIRMED", dueDate: { lt: today } };
    case "paid":
      return { status: "PAID" };
    default:
      return {};
  }
}

const invoiceRowSelect = {
  id: true,
  number: true,
  status: true,
  periodStart: true,
  periodEnd: true,
  dueDate: true,
  total: true,
  payments: { select: { amount: true } },
} satisfies Prisma.InvoiceSelect;

function withBalance<T extends { total: number; payments: { amount: number }[] }>(row: T) {
  const { payments, ...rest } = row;
  return { ...rest, balance: outstanding({ total: row.total, payments }) };
}

export async function listPortalInvoices(
  customerId: number,
  opts: { filter?: PortalFilter; q?: string; page: number; pageSize?: number; today: Date },
) {
  const q = opts.q?.trim();
  const take = opts.pageSize ?? PORTAL_PAGE_SIZE;
  const where: Prisma.InvoiceWhereInput = {
    AND: [invoiceScope(customerId), filterWhere(opts.filter, opts.today), q ? { number: { contains: q } } : {}],
  };
  const [rows, total] = await Promise.all([
    db.invoice.findMany({
      where,
      select: invoiceRowSelect,
      orderBy: { id: "desc" },
      take,
      skip: (opts.page - 1) * take,
    }),
    db.invoice.count({ where }),
  ]);
  return { total, rows: rows.map(withBalance) };
}

export type PortalInvoiceRow = Awaited<ReturnType<typeof listPortalInvoices>>["rows"][number];

export async function overdueSummary(customerId: number, today: Date) {
  const rows = await db.invoice.findMany({
    where: { AND: [invoiceScope(customerId), filterWhere("overdue", today)] },
    select: invoiceRowSelect,
  });
  return summariseOverdue(rows.map((r) => ({ number: r.number, dueDate: r.dueDate, balance: withBalance(r).balance })));
}

/** Same shape as the staff invoice detail, so the staff printable document can be reused as is. */
export async function getPortalInvoice(customerId: number, id: number) {
  const invoice = await db.invoice.findFirst({
    where: { id, ...invoiceScope(customerId) },
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

const planSelect = {
  name: true,
  periodUnit: true,
  periodCount: true,
  renewable: true,
  closable: true,
} satisfies Prisma.PlanSelect;

export async function listPortalSubscriptions(customerId: number) {
  return db.subscription.findMany({
    where: { customerId, status: { not: "DRAFT" } },
    select: {
      id: true,
      number: true,
      status: true,
      startDate: true,
      endDate: true,
      nextInvoiceDate: true,
      closeReason: true,
      plan: { select: planSelect },
      lines: { select: { productId: true, quantity: true, unitPrice: true, taxBps: true } },
    },
    orderBy: { id: "asc" },
  });
}

export type PortalSubscription = Awaited<ReturnType<typeof listPortalSubscriptions>>[number];

export async function getPortalSubscription(customerId: number, id: number) {
  const sub = await db.subscription.findFirst({
    where: { id, customerId, status: { not: "DRAFT" } },
    select: {
      id: true,
      number: true,
      status: true,
      startDate: true,
      endDate: true,
      nextInvoiceDate: true,
      paymentTermDays: true,
      closeReason: true,
      plan: { select: planSelect },
      lines: {
        select: { id: true, productId: true, quantity: true, unitPrice: true, taxBps: true },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!sub) return null;
  const [products, invoices] = await Promise.all([
    db.product.findMany({
      where: { id: { in: sub.lines.map((l) => l.productId) } },
      select: { id: true, name: true },
    }),
    db.invoice.findMany({
      where: { AND: [invoiceScope(customerId), { subscriptionId: sub.id }] },
      select: invoiceRowSelect,
      orderBy: { id: "desc" },
      take: 20,
    }),
  ]);
  const names = new Map(products.map((p) => [p.id, p.name]));
  return {
    ...sub,
    lines: sub.lines.map((l) => ({ ...l, productName: names.get(l.productId) ?? "Product" })),
    invoices: invoices.map(withBalance),
  };
}

export type PortalSubscriptionDetail = NonNullable<Awaited<ReturnType<typeof getPortalSubscription>>>;

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/current-user";
import { SUBSCRIPTION_STATUSES, INVOICE_STATUSES } from "@/lib/state";

export const PAGE_SIZE = 12;
const safePage = (page: number) => Number.isSafeInteger(page) ? Math.min(10_000, Math.max(1, page)) : 1;

export async function portalOverview({ status, q, page = 1 }: { status?: string; q?: string; page?: number }) {
  const user = await requirePageRole(["CUSTOMER"]);
  const own = { customer: { userId: user.id } };
  const where: Prisma.SubscriptionWhereInput = { ...own,
    ...((SUBSCRIPTION_STATUSES as readonly string[]).includes(status || "") ? { status } : {}),
    ...(q?.trim() ? { OR: [{ number: { contains: q.trim().slice(0, 100) } }, { plan: { name: { contains: q.trim().slice(0, 100) } } }] } : {}),
  };
  const [rows, total, active, billed, paid, next] = await Promise.all([
    db.subscription.findMany({ where, include: { plan: true, lines: { select: { quantity: true, unitPrice: true } } }, orderBy: { id: "desc" }, take: PAGE_SIZE, skip: (safePage(page) - 1) * PAGE_SIZE }),
    db.subscription.count({ where }),
    db.subscription.count({ where: { ...own, status: "ACTIVE" } }),
    db.invoice.aggregate({ where: { ...own, status: "CONFIRMED" }, _sum: { total: true } }),
    db.payment.aggregate({ where: { invoice: { ...own, status: "CONFIRMED" } }, _sum: { amount: true } }),
    db.subscription.findFirst({ where: { ...own, status: "ACTIVE", nextInvoiceDate: { not: null } }, orderBy: { nextInvoiceDate: "asc" }, select: { nextInvoiceDate: true } }),
  ]);
  return { user, rows, total, active, page: safePage(page), outstanding: (billed._sum.total || 0) - (paid._sum.amount || 0), nextInvoiceDate: next?.nextInvoiceDate || null };
}

export async function portalInvoices({ status, q, page = 1 }: { status?: string; q?: string; page?: number }) {
  const user = await requirePageRole(["CUSTOMER"]);
  const where: Prisma.InvoiceWhereInput = { customer: { userId: user.id },
    ...(status === "OVERDUE" ? { status: "CONFIRMED", dueDate: { lt: new Date() } } : (INVOICE_STATUSES as readonly string[]).includes(status || "") ? { status } : {}),
    ...(q?.trim() ? { number: { contains: q.trim().slice(0, 100) } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.invoice.findMany({ where, include: { payments: { select: { amount: true } }, subscription: { select: { number: true } } }, orderBy: { id: "desc" }, take: PAGE_SIZE, skip: (safePage(page) - 1) * PAGE_SIZE }),
    db.invoice.count({ where }),
  ]);
  return { rows: rows.map(({ payments, ...invoice }) => ({ ...invoice, balance: invoice.total - payments.reduce((sum, payment) => sum + payment.amount, 0) })), total, page: safePage(page) };
}

export async function portalInvoiceDetail(id: number) {
  const user = await requirePageRole(["CUSTOMER"]);
  // Include ownership in the initial query, including for printable invoice details.
  const invoice = await db.invoice.findFirst({ where: { id, customer: { userId: user.id } }, include: {
    customer: true, lines: { orderBy: { id: "asc" } }, payments: { orderBy: { paidOn: "asc" } }, subscription: { select: { id: true, number: true, plan: { select: { name: true } } } },
  } });
  if (!invoice) return null;
  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return { ...invoice, paid, balance: invoice.total - paid };
}

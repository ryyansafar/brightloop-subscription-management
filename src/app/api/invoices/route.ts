import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handle, ok, ownCustomerFilter, pageParams, readJson } from "@/lib/api";
import { generateInvoiceNow } from "@/lib/invoices";
import { INVOICE_STATUSES } from "@/lib/state";

export const GET = handle(["ADMIN", "STAFF", "CUSTOMER"], async ({ request, user }) => {
  const url = new URL(request.url);
  const { page, take, skip } = pageParams(url);
  const status = url.searchParams.get("status");
  const subscriptionId = Number(url.searchParams.get("subscriptionId")) || undefined;
  const overdue = url.searchParams.get("overdue") === "1";

  const where: Prisma.InvoiceWhereInput = {
    ...ownCustomerFilter(user),
    ...(status && (INVOICE_STATUSES as readonly string[]).includes(status) ? { status } : {}),
    ...(subscriptionId ? { subscriptionId } : {}),
    // overdue = confirmed (unpaid) and past its due date
    ...(overdue ? { status: "CONFIRMED", dueDate: { lt: new Date() } } : {}),
  };
  const [items, total] = await Promise.all([
    db.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { id: "desc" },
      take,
      skip,
    }),
    db.invoice.count({ where }),
  ]);
  const withBalance = items.map(({ payments, ...invoice }) => ({
    ...invoice,
    paid: payments.reduce((sum, p) => sum + p.amount, 0),
  }));
  return ok({ items: withBalance, total, page, limit: take });
});

const generateSchema = z.object({ subscriptionId: z.number().int().positive() });

/** Create the next period's invoice for a subscription. */
export const POST = handle(["ADMIN", "STAFF"], async ({ request }) => {
  const { subscriptionId } = generateSchema.parse(await readJson(request));
  const id = await generateInvoiceNow(subscriptionId);
  return ok({ id }, 201);
});

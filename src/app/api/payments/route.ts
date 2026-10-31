import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handle, ok, ownCustomerFilter, pageParams, readJson } from "@/lib/api";
import { recordPayment } from "@/lib/payments";

export const GET = handle(["ADMIN", "STAFF", "CUSTOMER"], async ({ request, user }) => {
  const url = new URL(request.url);
  const { page, take, skip } = pageParams(url);
  const invoiceId = Number(url.searchParams.get("invoiceId")) || undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Prisma.PaymentWhereInput = {
    ...(user.role === "CUSTOMER" ? { invoice: ownCustomerFilter(user) } : {}),
    ...(invoiceId ? { invoiceId } : {}),
    ...(from || to
      ? { paidOn: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.payment.findMany({
      where,
      include: { invoice: { select: { id: true, number: true } } },
      orderBy: { paidOn: "desc" },
      take,
      skip,
    }),
    db.payment.count({ where }),
  ]);
  return ok({ items, total, page, limit: take });
});

export const POST = handle(["ADMIN", "STAFF"], async ({ request }) => {
  const result = await recordPayment((await readJson(request)) as never);
  return ok(result, 201);
});

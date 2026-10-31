import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handle, intParam, ok, ownCustomerFilter, pageParams, readJson } from "@/lib/api";
import { DomainError } from "@/lib/errors";
import { z } from "zod";
import { recordPayment } from "@/lib/payments";

export const GET = handle(["ADMIN", "STAFF", "CUSTOMER"], async ({ request, user }) => {
  const url = new URL(request.url);
  const { page, take, skip } = pageParams(url);
  const invoiceValue = url.searchParams.get("invoiceId");
  const invoiceId = invoiceValue ? intParam(invoiceValue, "invoiceId") : undefined;
  const readDate = (name: string) => {
    const value = url.searchParams.get(name);
    if (!value) return undefined;
    if (!z.union([z.iso.date(), z.iso.datetime({ offset: true })]).safeParse(value).success) throw new DomainError(`Invalid ${name} date`);
    return new Date(value);
  };
  const from = readDate("from");
  const to = readDate("to");
  const wholeDay = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to") || "");
  const end = to && wholeDay ? new Date(to.getTime() + 86_400_000) : to;
  if (from && end && (wholeDay ? from >= end : from > end)) throw new DomainError("From date must not be after to date");

  const where: Prisma.PaymentWhereInput = {
    ...(user.role === "CUSTOMER" ? { invoice: ownCustomerFilter(user) } : {}),
    ...(invoiceId ? { invoiceId } : {}),
    ...(from || to
      ? { paidOn: { ...(from ? { gte: from } : {}), ...(end ? wholeDay ? { lt: end } : { lte: end } : {}) } }
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

import { db } from "@/lib/db";
import { handle, ok, ownCustomerFilter, pageParams, readJson } from "@/lib/api";
import { SUBSCRIPTION_STATUSES } from "@/lib/state";
import { createSubscription } from "@/lib/subscriptions";

export const GET = handle(["ADMIN", "STAFF", "CUSTOMER"], async ({ request, user }) => {
  const url = new URL(request.url);
  const { page, take, skip } = pageParams(url);
  const status = url.searchParams.get("status");
  const customerId = Number(url.searchParams.get("customerId")) || undefined;

  const where = {
    ...ownCustomerFilter(user),
    ...(status && (SUBSCRIPTION_STATUSES as readonly string[]).includes(status) ? { status } : {}),
    ...(customerId && user.role !== "CUSTOMER" ? { customerId } : {}),
  };
  const [items, total] = await Promise.all([
    db.subscription.findMany({
      where,
      include: { customer: { select: { id: true, name: true } }, plan: { select: { id: true, name: true } } },
      orderBy: { id: "desc" },
      take,
      skip,
    }),
    db.subscription.count({ where }),
  ]);
  return ok({ items, total, page, limit: take });
});

export const POST = handle(["ADMIN", "STAFF"], async ({ request }) => {
  const created = await createSubscription((await readJson(request)) as never);
  return ok(created, 201);
});

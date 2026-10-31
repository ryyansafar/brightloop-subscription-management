import { db } from "@/lib/db";
import { handle, intParam, ok, ownCustomerFilter } from "@/lib/api";
import { DomainError } from "@/lib/errors";

export const GET = handle<{ id: string }>(
  ["ADMIN", "STAFF", "CUSTOMER"],
  async ({ user, params }) => {
    const subscription = await db.subscription.findFirst({
      where: { id: intParam(params.id), ...ownCustomerFilter(user) },
      include: {
        customer: true,
        plan: true,
        lines: true,
        invoices: {
          select: { id: true, number: true, status: true, total: true, dueDate: true },
          orderBy: { periodStart: "desc" },
        },
      },
    });
    if (!subscription) throw new DomainError("Subscription not found", 404);
    return ok(subscription);
  },
);

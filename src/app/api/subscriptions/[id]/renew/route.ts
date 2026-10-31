import { db } from "@/lib/db";
import { handle, intParam, ok, ownCustomerFilter } from "@/lib/api";
import { DomainError } from "@/lib/errors";
import { renewSubscription } from "@/lib/subscriptions";

export const POST = handle<{ id: string }>(
  ["ADMIN", "STAFF", "CUSTOMER"],
  async ({ user, params }) => {
    const id = intParam(params.id);
    const own = await db.subscription.findFirst({
      where: { id, ...ownCustomerFilter(user) },
      select: { id: true },
    });
    if (!own) throw new DomainError("Subscription not found", 404);
    const endDate = await renewSubscription(id);
    return ok({ id, endDate });
  },
);

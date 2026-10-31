import { z } from "zod";
import { db } from "@/lib/db";
import { handle, intParam, ok, ownCustomerFilter, readJson } from "@/lib/api";
import { DomainError } from "@/lib/errors";
import { SUBSCRIPTION_STATUSES } from "@/lib/state";
import { transitionSubscription } from "@/lib/subscriptions";

const bodySchema = z.object({
  to: z.enum(SUBSCRIPTION_STATUSES),
  closeReason: z.string().trim().max(300).optional(),
});

export const POST = handle<{ id: string }>(
  ["ADMIN", "STAFF", "CUSTOMER"],
  async ({ request, user, params }) => {
    const id = intParam(params.id);
    const body = bodySchema.parse(await readJson(request));

    if (user.role === "CUSTOMER") {
      // customers may only close their own subscription from the portal
      const own = await db.subscription.findFirst({
        where: { id, ...ownCustomerFilter(user) },
        select: { id: true },
      });
      if (!own) throw new DomainError("Subscription not found", 404);
      if (body.to !== "CLOSED") throw new DomainError("You can only close a subscription", 403);
    }

    await transitionSubscription(id, body.to, { closeReason: body.closeReason });
    return ok({ id, status: body.to });
  },
);

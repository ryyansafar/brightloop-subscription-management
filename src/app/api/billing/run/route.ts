import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { runBilling } from "@/lib/billing";
import { DomainError } from "@/lib/errors";

const bodySchema = z.object({ asOf: z.coerce.date().optional() });

/** Admin-only billing run. `asOf` lets the demo simulate a later billing date. */
export const POST = handle(["ADMIN"], async ({ request }) => {
  const text = await request.text();
  let raw: unknown = {};
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new DomainError("Request body must be valid JSON");
    }
  }
  const { asOf } = bodySchema.parse(raw);
  return ok(await runBilling(asOf ?? new Date()));
});

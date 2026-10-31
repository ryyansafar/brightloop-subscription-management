import { handle, intParam, ok } from "@/lib/api";
import { DomainError } from "@/lib/errors";
import { cancelInvoice, confirmInvoice, markInvoiceSent } from "@/lib/invoices";

const ACTIONS = {
  confirm: confirmInvoice,
  cancel: cancelInvoice,
  send: markInvoiceSent,
} as const;

export const POST = handle<{ id: string; action: string }>(["ADMIN", "STAFF"], async ({ params }) => {
  const action = params.action as keyof typeof ACTIONS;
  if (!(action in ACTIONS)) throw new DomainError("Unknown invoice action", 404);
  const id = intParam(params.id);
  const delivery = await ACTIONS[action](id);
  return ok({ id, action, ...(delivery || {}) });
});

import { db } from "@/lib/db";
import { handle, intParam, ok, ownCustomerFilter } from "@/lib/api";
import { DomainError } from "@/lib/errors";
import { outstanding } from "@/lib/invoices";

export const GET = handle<{ id: string }>(
  ["ADMIN", "STAFF", "CUSTOMER"],
  async ({ user, params }) => {
    const invoice = await db.invoice.findFirst({
      where: { id: intParam(params.id), ...ownCustomerFilter(user) },
      include: {
        customer: true,
        lines: true,
        payments: { orderBy: { paidOn: "asc" } },
        subscription: { select: { id: true, number: true } },
      },
    });
    if (!invoice) throw new DomainError("Invoice not found", 404);
    return ok({ ...invoice, outstanding: outstanding(invoice) });
  },
);

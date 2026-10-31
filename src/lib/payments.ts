import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { DomainError } from "./errors";
import { outstanding } from "./invoices";
import { PAYMENT_METHODS } from "./state";

export const recordPaymentSchema = z.object({
  invoiceId: z.number().int().positive(),
  method: z.enum(PAYMENT_METHODS),
  amount: z.number().int().positive("Amount must be greater than zero"),
  paidOn: z.coerce.date().default(() => new Date()),
  note: z.string().trim().max(500).nullish(),
});

export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

/** Record a payment against a confirmed invoice; the invoice becomes PAID when settled. */
export async function recordPayment(
  input: RecordPaymentInput,
  client: PrismaClient = db,
): Promise<{ paymentId: number; invoiceStatus: string; outstanding: number }> {
  const data = recordPaymentSchema.parse(input);

  return client.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { payments: true },
    });
    if (!invoice) throw new DomainError("Invoice not found", 404);
    if (invoice.status !== "CONFIRMED") {
      throw new DomainError("Payments can only be recorded against confirmed invoices", 409);
    }
    const due = outstanding(invoice);
    if (data.amount > due) {
      throw new DomainError(`Payment exceeds the outstanding amount of ${due} paise`, 409);
    }

    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        method: data.method,
        amount: data.amount,
        paidOn: data.paidOn,
        note: data.note ?? null,
      },
    });
    const remaining = due - data.amount;
    if (remaining === 0) {
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });
    }
    return {
      paymentId: payment.id,
      invoiceStatus: remaining === 0 ? "PAID" : "CONFIRMED",
      outstanding: remaining,
    };
  });
}

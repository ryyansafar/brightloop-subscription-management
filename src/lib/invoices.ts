import type { PrismaClient } from "@prisma/client";
import { db } from "./db";
import { billSubscription } from "./billing";
import { releaseInvoiceDiscounts } from "./discount-usage";
import { DomainError } from "./errors";
import { canMoveInvoice, type InvoiceStatus } from "./state";

export function outstanding(invoice: { total: number; payments: { amount: number }[] }): number {
  return invoice.total - invoice.payments.reduce((sum, p) => sum + p.amount, 0);
}

async function loadInvoice(client: PrismaClient, id: number) {
  const invoice = await client.invoice.findUnique({
    where: { id },
    include: { lines: true, payments: true },
  });
  if (!invoice) throw new DomainError("Invoice not found", 404);
  return invoice;
}

function assertMove(from: string, to: InvoiceStatus): void {
  if (!canMoveInvoice(from as InvoiceStatus, to)) {
    throw new DomainError(`Cannot move an invoice from ${from} to ${to}`, 409);
  }
}

export async function confirmInvoice(id: number, client: PrismaClient = db): Promise<void> {
  const invoice = await loadInvoice(client, id);
  assertMove(invoice.status, "CONFIRMED");
  await client.invoice.update({ where: { id }, data: { status: "CONFIRMED" } });
}

/**
 * Cancel an unpaid invoice and hand back any discount uses it consumed. The
 * period stays marked as invoiced, so billing will not create it a second time.
 */
export async function cancelInvoice(id: number, client: PrismaClient = db): Promise<void> {
  await client.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id },
      include: { lines: true, payments: true },
    });
    if (!invoice) throw new DomainError("Invoice not found", 404);
    assertMove(invoice.status, "CANCELLED");
    if (invoice.payments.length > 0) {
      throw new DomainError("An invoice with payments cannot be cancelled", 409);
    }
    await releaseInvoiceDiscounts(tx, invoice);
    await tx.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
  });
}

/** Mark a confirmed invoice as sent to the customer. */
export async function markInvoiceSent(id: number, client: PrismaClient = db): Promise<void> {
  const invoice = await loadInvoice(client, id);
  if (invoice.status !== "CONFIRMED" && invoice.status !== "PAID") {
    throw new DomainError("Only confirmed invoices can be sent", 409);
  }
  await client.invoice.update({ where: { id }, data: { sentAt: new Date() } });
}

/** Create the next period's invoice for a subscription right now. */
export async function generateInvoiceNow(
  subscriptionId: number,
  today: Date = new Date(),
  client: PrismaClient = db,
): Promise<number> {
  const outcome = await client.$transaction((tx) =>
    billSubscription(tx, subscriptionId, { today, force: true }),
  );
  const invoiceId = outcome.invoiceIds[0];
  if (invoiceId === undefined) {
    throw new DomainError("That period already has an invoice, or there is nothing to bill", 409);
  }
  return invoiceId;
}

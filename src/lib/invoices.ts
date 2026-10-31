import type { PrismaClient } from "@prisma/client";
import { db } from "./db";
import { billSubscription } from "./billing";
import { releaseInvoiceDiscounts } from "./discount-usage";
import { DomainError } from "./errors";
import { canMoveInvoice, type InvoiceStatus } from "./state";
import { sendInvoiceEmail } from "./invoice-mail";

export function outstanding(invoice: { total: number; payments: { amount: number }[] }): number {
  return invoice.total - invoice.payments.reduce((sum, p) => sum + p.amount, 0);
}

async function loadInvoice(client: PrismaClient, id: number) {
  const invoice = await client.invoice.findUnique({
    where: { id },
    include: { lines: true, payments: true, customer: { select: { email: true, name: true } } },
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

/** Record provider acceptance only after the confirmed invoice email was actually submitted. */
export async function markInvoiceSent(id: number, client: PrismaClient = db): Promise<void> {
  const invoice = await loadInvoice(client, id);
  if (invoice.status !== "CONFIRMED" && invoice.status !== "PAID") {
    throw new DomainError("Only confirmed invoices can be sent", 409);
  }
  await sendInvoiceEmail(invoice);
  await client.invoice.update({ where: { id }, data: { sentAt: new Date() } });
}

/**
 * Create the invoice(s) a subscription is due for right now. Billing ahead is refused: the
 * next period is only invoiced once its date has arrived, so a second click can never bill
 * a future period (use the Billing run page to simulate a later billing day).
 */
export async function generateInvoiceNow(
  subscriptionId: number,
  today: Date = new Date(),
  client: PrismaClient = db,
): Promise<number> {
  const outcome = await client.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      select: { status: true, nextInvoiceDate: true },
    });
    if (!sub) throw new DomainError("Subscription not found", 404);
    if (sub.status !== "ACTIVE") throw new DomainError("Only active subscriptions can be invoiced", 409);
    if (!sub.nextInvoiceDate) throw new DomainError("This subscription has nothing left to bill", 409);
    if (sub.nextInvoiceDate > today) {
      const due = sub.nextInvoiceDate.toISOString().slice(0, 10);
      throw new DomainError(`The next invoice is not due until ${due}, so there is nothing to bill yet`, 409);
    }
    return billSubscription(tx, subscriptionId, { today });
  });
  const invoiceId = outcome.invoiceIds[0];
  if (invoiceId === undefined) {
    throw new DomainError("That period already has an invoice, or there is nothing to bill", 409);
  }
  return invoiceId;
}

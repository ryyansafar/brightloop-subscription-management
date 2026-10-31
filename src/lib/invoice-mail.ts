import { createHash } from "node:crypto";
import { appOrigin } from "./auth/config";
import { escapeHtml, sendEmail } from "./mail";
import { formatINR } from "./money";

interface InvoiceNotice {
  id: number;
  number: string;
  total: number;
  dueDate: Date;
  sentAt: Date | null;
  customer: { email: string; name: string };
}

/** Share the protected portal link; never include an access token or a public invoice URL. */
export async function sendInvoiceEmail(invoice: InvoiceNotice): Promise<void> {
  const url = new URL(`/portal/invoices/${invoice.id}`, appOrigin()).href;
  const total = formatINR(invoice.total);
  const due = invoice.dueDate.toISOString().slice(0, 10);
  const text = `Hello ${invoice.customer.name},\n\nYour Brightloop invoice ${invoice.number} is ready.\nTotal: ${total}\nDue date: ${due}\n\nSign in to view and print your invoice: ${url}`;
  const html = `<h1>Invoice ${escapeHtml(invoice.number)}</h1><p>Hello ${escapeHtml(invoice.customer.name)},</p><p>Your invoice is ready.</p><p>Total: ${escapeHtml(total)}<br>Due date: ${due}</p><p><a href="${escapeHtml(url)}">Sign in to view and print your invoice</a></p>`;
  // Retries of the same notice share a key; a deliberate Send again after success gets a new key.
  const digest = createHash("sha256").update(JSON.stringify([text, html, invoice.customer.email, invoice.sentAt])).digest("hex");
  await sendEmail({ to: invoice.customer.email, subject: `Brightloop invoice ${invoice.number}`, text, html, idempotencyKey: `invoice/${invoice.id}/${digest}` });
}

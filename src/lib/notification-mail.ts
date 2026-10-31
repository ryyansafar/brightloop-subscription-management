import { appOrigin } from "./auth/config";
import { escapeHtml, sendEmail } from "./mail";
import { formatINR } from "./money";

interface Customer {
  name: string;
  email: string;
}

export interface PaymentReceivedInput {
  invoice: { id: number; number: string; customer: Customer };
  payment: { id: number; amount: number };
  /** Paise still owed after this payment; 0 means the invoice is paid in full. */
  outstanding: number;
}

export interface SubscriptionActivatedInput {
  subscription: { id: number; number: string };
  planName: string;
  customer: Customer;
  /** Recurring amount in paise, before tax. */
  recurringAmount: number;
  nextInvoiceDate: Date | null;
  /** Distinguishes activation events of the same subscription for idempotency. */
  activatedAt: Date;
}

const portalUrl = (path: string) => new URL(path, appOrigin()).href;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function layout(heading: string, paragraphs: readonly string[], link: { url: string; label: string }): string {
  const body = paragraphs.map((p) => `<p>${p}</p>`).join("");
  return `<h1>${heading}</h1>${body}<p><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></p>`;
}

/** Receipt for a recorded payment; a thank-you when it settles the invoice. */
export async function sendPaymentReceivedEmail({ invoice, payment, outstanding }: PaymentReceivedInput): Promise<void> {
  const url = portalUrl(`/portal/invoices/${invoice.id}`);
  const paid = formatINR(payment.amount);
  const settled = outstanding <= 0;
  const lines = settled
    ? [
        `Congratulations, your invoice ${invoice.number} is paid in full.`,
        `Thank you for your payment of ${paid}. We really appreciate it.`,
      ]
    : [
        `We received your payment of ${paid} for invoice ${invoice.number}.`,
        `Remaining balance: ${formatINR(outstanding)}.`,
      ];
  const label = "View your invoice";
  const text = [`Hello ${invoice.customer.name},`, ...lines, `${label}: ${url}`].join("\n\n");
  const html = layout(
    settled ? "Thank you!" : "Payment receipt",
    [`Hello ${escapeHtml(invoice.customer.name)},`, ...lines.map(escapeHtml)],
    { url, label },
  );
  await sendEmail({
    to: invoice.customer.email,
    subject: `Payment received for invoice ${invoice.number}`,
    text,
    html,
    idempotencyKey: `payment/${payment.id}`,
  });
}

/** Tell the customer their subscription is live and when the first invoice follows. */
export async function sendSubscriptionActivatedEmail(input: SubscriptionActivatedInput): Promise<void> {
  const { subscription, planName, customer, recurringAmount, nextInvoiceDate, activatedAt } = input;
  const url = portalUrl(`/portal/subscriptions/${subscription.id}`);
  const lines = [
    `Congratulations, your subscription ${subscription.number} is now active.`,
    `Plan: ${planName}`,
    `Recurring amount: ${formatINR(recurringAmount)} (before tax)`,
    ...(nextInvoiceDate ? [`Next invoice date: ${isoDate(nextInvoiceDate)}`] : []),
  ];
  const label = "View your subscription";
  const text = [`Hello ${customer.name},`, ...lines, `${label}: ${url}`].join("\n\n");
  const html = layout(
    "Your subscription is active",
    [`Hello ${escapeHtml(customer.name)},`, ...lines.map(escapeHtml)],
    { url, label },
  );
  await sendEmail({
    to: customer.email,
    subject: `Your Brightloop subscription ${subscription.number} is active`,
    text,
    html,
    idempotencyKey: `subscription-active/${subscription.id}/${activatedAt.toISOString()}`,
  });
}

/** Run a notification without letting a mail failure reach the caller. */
export async function bestEffort(label: string, send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (error) {
    console.error(`${label} notification email failed`, error instanceof Error ? error.message : "unknown error");
  }
}

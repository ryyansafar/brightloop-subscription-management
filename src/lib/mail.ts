// Server-only transactional transport. Never import this module into a Client Component.
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { DomainError } from "./errors";

export interface EmailMessage {
  from?: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}

export class EmailDeliveryError extends DomainError {
  constructor(public readonly retryable: boolean, public readonly retryAfterMs = 0) {
    super("Email could not be sent. Please try again later", 503);
  }
}

function configuration() {
  if (process.env.EMAIL_PROVIDER !== "resend") return null;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = z.email().safeParse(process.env.EMAIL_FROM?.trim());
  if (!apiKey || /\s/.test(apiKey) || !from.success) return null;
  return { apiKey, from: from.data };
}

export function emailConfigured(): boolean {
  return configuration() !== null;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

/** An accepted message is not proof of inbox delivery; bounces are visible in Resend. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const config = configuration();
  if (!config) throw new DomainError("Email delivery is not configured. Contact your administrator", 503);
  if (!z.email().safeParse(message.to).success || /[\r\n]/.test(message.subject)) {
    throw new DomainError("The email recipient or subject is invalid", 400);
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({ from: message.from ?? config.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) {
      const header = response.headers.get("retry-after") || "";
      const seconds = Number(header);
      const requested = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
      const retryAfter = Number.isFinite(requested) ? Math.max(0, Math.min(requested, 3_600_000)) : 0;
      throw new EmailDeliveryError(response.status === 429 || response.status >= 500 || response.status === 409, retryAfter);
    }
    const result: unknown = await response.json();
    if (!z.object({ id: z.string().min(1) }).safeParse(result).success) throw new Error("Invalid provider response");
  } catch (error) {
    unstable_rethrow(error);
    // Provider responses and exception objects can contain recipients, tokens or credentials.
    if (error instanceof EmailDeliveryError) throw error;
    throw new EmailDeliveryError(true);
  }
}

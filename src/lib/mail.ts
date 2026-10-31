// Server-only transactional transport. Never import this module into a Client Component.
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { DomainError } from "./errors";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
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
      body: JSON.stringify({ from: config.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new Error("Provider rejected message");
    const result: unknown = await response.json();
    if (!z.object({ id: z.string().min(1) }).safeParse(result).success) throw new Error("Invalid provider response");
  } catch (error) {
    unstable_rethrow(error);
    // Provider responses and exception objects can contain recipients, tokens or credentials.
    throw new DomainError("Email could not be sent. Please try again later", 503);
  }
}

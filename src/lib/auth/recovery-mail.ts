import { emailConfigured, escapeHtml, sendEmail } from "@/lib/mail";
import { devMailerEnabled } from "./config";

export function recoveryMailAvailable(): boolean {
  // A configured provider takes precedence over the local development shortcut.
  const provider = process.env.EMAIL_PROVIDER;
  return emailConfigured() || ((!provider || provider === "disabled") && devMailerEnabled());
}

export async function sendRecoveryEmail(email: string, url: string, minutes: number, resetId: number) {
  if (process.env.EMAIL_PROVIDER === "resend") {
    await sendEmail({
      to: email,
      subject: "Reset your Brightloop password",
      text: `Reset your Brightloop password: ${url}\n\nThis link expires in ${minutes} minutes and works once. If you did not request it, you can ignore this email.`,
      html: `<h1>Reset your Brightloop password</h1><p><a href="${escapeHtml(url)}">Choose a new password</a></p><p>This link expires in ${minutes} minutes and works once.</p><p>If you did not request it, you can ignore this email.</p>`,
      idempotencyKey: `password-reset/${resetId}`,
    });
    return {};
  }
  // This branch is reachable only after the existing local-only development opt-in.
  if (!devMailerEnabled()) throw new Error("Development mailer is disabled");
  console.info(`[dev mailer] Password reset for ${email}: ${url}`);
  return { devResetUrl: url };
}

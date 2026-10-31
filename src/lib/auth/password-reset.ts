import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { AuthError, limitAuthAttempt } from "./security";
import { appOrigin } from "./config";
import { recoveryMailAvailable, recoveryMessage, sendRecoveryEmail } from "./recovery-mail";
import { enqueueEmail, deliverQueuedEmail } from "@/lib/mail-outbox";
import { unstable_rethrow } from "next/navigation";
import { hashPassword } from "./password-work";
import { forgotPasswordSchema, resetPasswordSchema } from "./validation";

export const RESET_MINUTES = 30;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const invalidToken = () => new AuthError("Reset link is invalid or expired. Request a new link", 400);

/** Real mail never returns or logs a reset token; local previews require explicit opt-in. */
export async function requestPasswordReset(input: unknown, source: string) {
  const { email } = forgotPasswordSchema.parse(input);
  await limitAuthAttempt("reset", email, source);
  if (!recoveryMailAvailable()) {
    throw new AuthError("Password recovery mail delivery is not configured", 503);
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return {};
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_MINUTES * 60_000);
  // Never derive reset URLs from untrusted Host/Origin headers.
  const url = new URL("/reset-password", appOrigin());
  url.searchParams.set("token", token);
  const { record, jobId } = await db.$transaction(async (tx) => {
    await tx.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    const record = await tx.passwordReset.create({ data: {
      userId: user.id, tokenHash: tokenHash(token), expiresAt,
    } });
    const jobId = process.env.EMAIL_PROVIDER === "resend"
      ? await enqueueEmail(recoveryMessage(email, url.href, RESET_MINUTES, record.id), { kind: "password-reset", referenceId: record.id, expiresAt }, tx)
      : null;
    return { record, jobId };
  });
  try {
    if (jobId) { await deliverQueuedEmail(jobId); return {}; }
    return await sendRecoveryEmail(email, url.href, RESET_MINUTES, record.id);
  } catch (error) {
    unstable_rethrow(error);
    // Do not expose account existence through a different response on provider failure.
    await db.passwordReset.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    console.error("Password recovery email delivery failed");
    return {};
  }
}

export async function resetPassword(input: unknown): Promise<void> {
  const { token, password } = resetPasswordSchema.parse(input);
  const digest = tokenHash(token);
  const record = await db.passwordReset.findUnique({ where: { tokenHash: digest } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) throw invalidToken();
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const now = new Date();
    // Conditional consumption makes concurrent redemption succeed at most once.
    const consumed = await tx.passwordReset.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now },
    });
    if (consumed.count !== 1) throw invalidToken();
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash, sessionVersion: { increment: 1 }, emailVerifiedAt: now } });
    await tx.passwordReset.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: now } });
    await tx.emailVerification.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: now } });
  });
}

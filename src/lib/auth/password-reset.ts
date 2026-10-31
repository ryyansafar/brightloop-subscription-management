import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { AuthError, limitAuthAttempt } from "./security";
import { forgotPasswordSchema, resetPasswordSchema } from "./validation";

export const RESET_MINUTES = 30;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const invalidToken = () => new AuthError("Reset link is invalid or expired. Request a new link", 400);

/** Only development returns/logs a link; a production mail transport is a separate integration. */
export async function requestPasswordReset(input: unknown) {
  const { email } = forgotPasswordSchema.parse(input);
  limitAuthAttempt("reset", email);
  if (process.env.NODE_ENV === "production") {
    throw new AuthError("Password recovery mail delivery is not configured", 503);
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return {};
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    await tx.passwordReset.create({ data: {
      userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(now.getTime() + RESET_MINUTES * 60_000),
    } });
  });
  // Never derive reset URLs from untrusted Host/Origin headers.
  const url = new URL("/reset-password", process.env.APP_ORIGIN || "http://localhost:3000");
  url.searchParams.set("token", token);
  console.info(`[dev mailer] Password reset for ${email}: ${url.href}`);
  return { devResetUrl: url.href };
}

export async function resetPassword(input: unknown): Promise<void> {
  const { token, password } = resetPasswordSchema.parse(input);
  const digest = tokenHash(token);
  const record = await db.passwordReset.findUnique({ where: { tokenHash: digest } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) throw invalidToken();
  const passwordHash = await hash(password, 12);
  await db.$transaction(async (tx) => {
    const now = new Date();
    // Conditional consumption makes concurrent redemption succeed at most once.
    const consumed = await tx.passwordReset.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now },
    });
    if (consumed.count !== 1) throw invalidToken();
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordReset.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: now } });
  });
}

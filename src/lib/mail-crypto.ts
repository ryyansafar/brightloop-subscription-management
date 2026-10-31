import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

function key() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters");
  return createHmac("sha256", secret).update("brightloop:mail-outbox:v1").digest();
}

/** Retry payloads contain private recipients and reset links: encrypt them, not just the token table. */
export function encryptMail(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptMail(value: string): unknown {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted message");
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(encrypted), cipher.final()]).toString("utf8"));
}

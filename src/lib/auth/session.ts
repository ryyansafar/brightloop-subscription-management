import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/state";
import type { SessionUser } from "@/lib/api-auth";

export const SESSION_COOKIE = "brightloop_session";
export const sessionCookieName = () => process.env.NODE_ENV === "production" ? `__Host-${SESSION_COOKIE}` : SESSION_COOKIE;
export const SESSION_SECONDS = 60 * 60 * 8;

const claimsSchema = z.object({
  id: z.number().int().positive(),
  expires: z.number().int().positive(),
  version: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

function secret(): string {
  const value = process.env.AUTH_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters");
  return value;
}

export function assertSessionConfigured(): void { secret(); }

const version = (hash: string) => createHmac("sha256", secret()).update(`password-version:${hash}`).digest("hex");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSession(user: { id: number; passwordHash: string }, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    expires: Math.floor(now / 1000) + SESSION_SECONDS,
    version: version(user.passwordHash),
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string, now = Date.now()) {
  if (token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const [payload, signature] = parts;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const result = claimsSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    return result.success && result.data.expires > Math.floor(now / 1000) ? result.data : null;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, clear = false): string {
  return `${sessionCookieName()}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_SECONDS}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const name = sessionCookieName();
  const matches = request.headers.get("cookie")?.split(";")
    .map((part) => part.trim()).filter((part) => part.startsWith(`${name}=`)) ?? [];
  if (matches.length !== 1) return null;
  const token = matches[0].slice(name.length + 1);
  if (!token) return null;
  const claims = verifySession(token);
  if (!claims) return null;
  // Read roles from the database on every request. Password changes revoke old cookies.
  const user = await db.user.findUnique({ where: { id: claims.id } });
  if (!user || version(user.passwordHash) !== claims.version || !ROLES.includes(user.role as typeof ROLES[number])) return null;
  return { id: user.id, email: user.email, role: user.role as typeof ROLES[number] };
}

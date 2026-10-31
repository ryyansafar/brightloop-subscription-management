import { DomainError } from "@/lib/errors";

/** SameSite cookies are supplemented with an origin check for browser mutations. */
export function assertSameOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_ORIGIN || request.url).origin;
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== expected)) {
    throw new DomainError("Cross-origin requests are not allowed", 403);
  }
}

export class AuthError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

const buckets = new Map<string, { count: number; until: number }>();
const WINDOW = 15 * 60 * 1000;

/** Hackathon single-process limit. Use a shared store before deploying multiple instances. */
export function limitAuthAttempt(action: string, email: string, now = Date.now()): void {
  for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
  const key = `${action}:${email}`;
  const bucket = buckets.get(key);
  if ((!bucket && buckets.size >= 10_000) || (bucket && bucket.count >= 10)) {
    throw new AuthError("Too many attempts. Try again in 15 minutes", 429);
  }
  buckets.set(key, { count: (bucket?.count ?? 0) + 1, until: bucket?.until ?? now + WINDOW });
}

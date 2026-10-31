import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { DomainError } from "@/lib/errors";
import { appOrigin, isLoopbackHost } from "./config";

/** SameSite cookies are supplemented with an origin check for browser mutations. */
export function assertSameOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const expected = appOrigin();
  if (site === "cross-site" || (origin && origin !== expected) ||
      (process.env.NODE_ENV === "production" && request.headers.has("cookie") &&
        !origin && site !== "same-origin")) {
    throw new DomainError("Cross-origin requests are not allowed", 403);
  }
}

export class AuthError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

/** Fixed-window counters with bounded memory and amortized O(1) expiry cleanup. */
export class AttemptLimiter {
  private readonly buckets = new Map<string, { count: number; until: number }>();

  constructor(private readonly limit: number, private readonly capacity: number,
    private readonly windowMs = 15 * 60_000) {}

  consume(key: string, now = Date.now()): void {
    // Equal TTLs and insertion order let us remove only the expired prefix.
    for (const [oldest, bucket] of this.buckets) {
      if (bucket.until > now) break;
      this.buckets.delete(oldest);
    }
    const bucket = this.buckets.get(key);
    if (bucket && bucket.count >= this.limit) {
      throw new AuthError("Too many attempts. Try again in 15 minutes", 429);
    }
    if (!bucket && this.buckets.size >= this.capacity) {
      // Capacity must never lock out every previously unseen user.
      this.buckets.delete(this.buckets.keys().next().value!);
    }
    this.buckets.set(key, { count: (bucket?.count ?? 0) + 1, until: bucket?.until ?? now + this.windowMs });
  }

  clear(key: string): void { this.buckets.delete(key); }
}

// Share limits across separately bundled Next route modules within this Node process.
const globalForLimits = globalThis as typeof globalThis & {
  brightloopAuthLimits?: { source: AttemptLimiter; account: AttemptLimiter };
};
const limits = globalForLimits.brightloopAuthLimits ??= {
  source: new AttemptLimiter(40, 10_000), account: new AttemptLimiter(10, 10_000),
};
const keyHash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Only enable this header when a trusted ingress strips and overwrites it on EVERY request. */
export function authSource(request: Request): string {
  const header = process.env.AUTH_TRUSTED_IP_HEADER;
  if (header) {
    const address = request.headers.get(header)?.trim();
    // The edge must supply one verified client address, never an untrusted forwarded list.
    if (!address || !isIP(address)) throw new AuthError("Client address is unavailable", 503);
    return keyHash(address);
  }
  const localDevelopment = process.env.NODE_ENV === "development" ||
    (process.env.NODE_ENV === "test" && process.env.VITEST === "true");
  if (!localDevelopment || !isLoopbackHost(new URL(appOrigin()).hostname) ||
      !isLoopbackHost(new URL(request.url).hostname)) {
    throw new AuthError("Trusted client address configuration is required", 503);
  }
  // Local development has one shared source. Arbitrary X-Forwarded-For is deliberately ignored.
  return "local-development";
}

export function limitAuthSource(request: Request): void {
  limits.source.consume(authSource(request));
}

export function limitAuthAttempt(action: string, email: string, source: string): void {
  limits.account.consume(keyHash(JSON.stringify([action, source, email])));
}

export function clearAuthAttempts(action: string, email: string, source: string): void {
  limits.account.clear(keyHash(JSON.stringify([action, source, email])));
}

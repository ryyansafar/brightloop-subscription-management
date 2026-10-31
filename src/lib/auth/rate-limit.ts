import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthError } from "./errors";

export const AUTH_WINDOW_MS = 15 * 60_000;

/** One conditional SQL write makes the limit atomic across processes sharing this database. */
export class DatabaseAttemptLimiter {
  constructor(private readonly limit: number, private readonly namespace: string, private readonly client: PrismaClient = db) {}

  private key(value: string) {
    return `${this.namespace}:${createHash("sha256").update(value).digest("hex")}`;
  }

  async consume(value: string, now = Date.now()): Promise<void> {
    const key = this.key(value);
    const current = BigInt(now);
    const reset = BigInt(now + AUTH_WINDOW_MS);
    let consumed: number;
    try {
      // Indexed expiry cleanup keeps storage bounded by live windows, without evicting active limits.
      await this.client.authRateLimit.deleteMany({ where: { resetAtMs: { lte: current } } });
      consumed = await this.client.$executeRaw`
        INSERT INTO "AuthRateLimit" ("key", "count", "resetAtMs") VALUES (${key}, 1, ${reset})
        ON CONFLICT("key") DO UPDATE SET
          "count" = CASE WHEN "resetAtMs" <= ${current} THEN 1 ELSE "count" + 1 END,
          "resetAtMs" = CASE WHEN "resetAtMs" <= ${current} THEN ${reset} ELSE "resetAtMs" END
        WHERE "resetAtMs" <= ${current} OR "count" < ${this.limit}`;
    } catch {
      throw new AuthError("Authentication limits are temporarily unavailable", 503);
    }
    if (consumed !== 1) throw new AuthError("Too many attempts. Try again in 15 minutes", 429);
  }

  async clear(value: string): Promise<void> {
    await this.client.authRateLimit.deleteMany({ where: { key: this.key(value) } });
  }
}

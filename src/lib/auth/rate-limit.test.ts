import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { DatabaseAttemptLimiter, AUTH_WINDOW_MS } from "./rate-limit";

beforeEach(() => db.authRateLimit.deleteMany());
afterEach(() => vi.restoreAllMocks());

describe("shared database rate limits", () => {
  it("enforces one atomic budget across independent database connections", async () => {
    const peer = new PrismaClient();
    try {
      const first = new DatabaseAttemptLimiter(5, "concurrent", db);
      const second = new DatabaseAttemptLimiter(5, "concurrent", peer);
      const outcomes = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => (index % 2 ? first : second).consume("same-source")));
      expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(5);
      expect(outcomes.filter((result) => result.status === "rejected").every((result) => result.reason.status === 429)).toBe(true);
      expect((await db.authRateLimit.findFirstOrThrow()).count).toBe(5);
    } finally { await peer.$disconnect(); }
  });

  it("preserves counters when a new limiter instance starts and resets at expiry", async () => {
    const first = new DatabaseAttemptLimiter(1, "restart");
    await first.consume("source", 1000);
    const restarted = new DatabaseAttemptLimiter(1, "restart");
    await expect(restarted.consume("source", 1000)).rejects.toMatchObject({ status: 429 });
    await expect(restarted.consume("source", 1000 + AUTH_WINDOW_MS)).resolves.toBeUndefined();
  });

  it("does not make a full store a global outage or evict active budgets", async () => {
    const now = Date.now();
    const live = new DatabaseAttemptLimiter(1, "capacity");
    await live.consume("existing", now);
    for (let offset = 0; offset < 10_100; offset += 1000) {
      await db.authRateLimit.createMany({ data: Array.from({ length: Math.min(1000, 10_100 - offset) }, (_, index) => ({ key: `unrelated:${offset + index}`, count: 1, resetAtMs: BigInt(now + AUTH_WINDOW_MS) })) });
    }
    await expect(live.consume("new-user", now)).resolves.toBeUndefined();
    await expect(live.consume("existing", now)).rejects.toMatchObject({ status: 429 });
  });

  it("clears only the intended key and namespace", async () => {
    const account = new DatabaseAttemptLimiter(1, "account-test");
    const source = new DatabaseAttemptLimiter(1, "source-test");
    await account.consume("same"); await source.consume("same");
    await account.clear("same");
    await expect(account.consume("same")).resolves.toBeUndefined();
    await expect(source.consume("same")).rejects.toMatchObject({ status: 429 });
  });

  it("fails closed without exposing database diagnostics", async () => {
    vi.spyOn(db.authRateLimit, "deleteMany").mockRejectedValueOnce(new Error("secret connection details"));
    await expect(new DatabaseAttemptLimiter(1, "unavailable").consume("source")).rejects.toMatchObject({ status: 503, message: "Authentication limits are temporarily unavailable" });
  });
});

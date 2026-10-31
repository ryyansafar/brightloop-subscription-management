import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, SESSION_SECONDS, sessionCookie, verifySession } from "./session";
import { assertSameOrigin, limitAuthAttempt } from "./security";

beforeEach(() => vi.stubEnv("AUTH_SESSION_SECRET", "test-secret-with-at-least-32-characters"));
afterEach(() => vi.unstubAllEnvs());
const user = { id: 1, passwordHash: "a-password-hash" };

describe("signed sessions", () => {
  it("verifies a valid token and expires at the boundary", () => {
    const token = createSession(user, 1_000_000);
    expect(verifySession(token, 1_000_000)?.id).toBe(1);
    expect(verifySession(token, 1_000_000 + SESSION_SECONDS * 1000)).toBeNull();
  });

  it("rejects tampering, malformed tokens and oversize input", () => {
    const token = createSession(user);
    const [payload, signature] = token.split(".");
    const altered = Buffer.from(JSON.stringify({ id: 2 })).toString("base64url");
    for (const value of ["", "broken", `${payload}.invalid`, `${altered}.${signature}`, `${token}.extra`, "x".repeat(1025)]) {
      expect(verifySession(value)).toBeNull();
    }
  });

  it("rejects a missing or weak signing key", () => {
    vi.stubEnv("AUTH_SESSION_SECRET", "weak");
    expect(() => createSession(user)).toThrow(/AUTH_SESSION_SECRET/);
  });

  it("sets HttpOnly, SameSite, expiry, and production Secure flags", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookie("token")).toContain("HttpOnly; SameSite=Lax; Max-Age=28800; Secure");
    expect(sessionCookie("", true)).toContain("Max-Age=0");
  });
});

describe("request safety", () => {
  it("rejects cross-origin browser mutations", () => {
    expect(() => assertSameOrigin(new Request("http://localhost/api/auth/login", {
      method: "POST", headers: { origin: "https://evil.test" },
    }))).toThrow(/Cross-origin/);
    expect(() => assertSameOrigin(new Request("http://localhost/api/auth/login", {
      method: "POST", headers: { "sec-fetch-site": "cross-site" },
    }))).toThrow(/Cross-origin/);
  });

  it("accepts the configured public origin behind a reverse proxy", () => {
    vi.stubEnv("APP_ORIGIN", "https://brightloop.test");
    expect(() => assertSameOrigin(new Request("http://internal/api/auth/login", {
      method: "POST", headers: { origin: "https://brightloop.test" },
    }))).not.toThrow();
  });

  it("limits repeated attempts and resets after the window", () => {
    for (let i = 0; i < 10; i++) limitAuthAttempt("unit", "rate@test.dev", 1000);
    expect(() => limitAuthAttempt("unit", "rate@test.dev", 1000)).toThrow(/Too many attempts/);
    expect(() => limitAuthAttempt("unit", "rate@test.dev", 1000 + 15 * 60_000)).not.toThrow();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { appOrigin, devMailerEnabled } from "./config";
import { assertSameOrigin, AttemptLimiter, authSource, clearAuthAttempts, limitAuthAttempt } from "./security";
import { PasswordWorkGate } from "./password-work";

afterEach(() => vi.unstubAllEnvs());

describe("bounded authentication limits", () => {
  it("does not turn bucket capacity into a global lockout", () => {
    const limiter = new AttemptLimiter(10, 10_000);
    for (let i = 0; i < 10_100; i++) limiter.consume(`fake-${i}`, 1000);
    expect(() => limiter.consume("real-user", 1000)).not.toThrow();
    for (let i = 0; i < 9; i++) limiter.consume("real-user", 1000);
    expect(() => limiter.consume("real-user", 1000)).toThrow(/Too many/);
  });

  it("does not let one source lock a target email out on another source", async () => {
    await clearAuthAttempts("login", "target@test.dev", "attacker");
    await clearAuthAttempts("login", "target@test.dev", "legitimate");
    for (let i = 0; i < 10; i++) await limitAuthAttempt("login", "target@test.dev", "attacker");
    await expect(limitAuthAttempt("login", "target@test.dev", "attacker")).rejects.toThrow(/Too many/);
    await expect(limitAuthAttempt("login", "target@test.dev", "legitimate")).resolves.toBeUndefined();
    await clearAuthAttempts("login", "target@test.dev", "attacker");
    await expect(limitAuthAttempt("login", "target@test.dev", "attacker")).resolves.toBeUndefined();
  });

  it("ignores forged forwarding headers unless an ingress header is explicitly configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("AUTH_TRUSTED_IP_HEADER", "");
    const first = authSource(new Request("http://localhost/api/auth/login", { headers: { "x-forwarded-for": "192.0.2.1" } }));
    const second = authSource(new Request("http://localhost/api/auth/login", { headers: { "x-forwarded-for": "192.0.2.2" } }));
    expect(first).toBe(second);
    vi.stubEnv("NODE_ENV", "production");
    expect(() => authSource(new Request("https://brightloop.test"))).toThrow(/Trusted client/);
  });

  it("requires one valid client address from the configured trusted ingress", () => {
    vi.stubEnv("AUTH_TRUSTED_IP_HEADER", "x-edge-client-ip");
    for (const value of ["", "attacker", "192.0.2.1, 192.0.2.2"]) {
      expect(() => authSource(new Request("https://brightloop.test", { headers: { "x-edge-client-ip": value } }))).toThrow(/unavailable/);
    }
    const key = authSource(new Request("https://brightloop.test", { headers: { "x-edge-client-ip": "2001:db8::1" } }));
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("expensive password work", () => {
  it("bounds concurrent jobs, rejects overload without queuing and releases finished slots", async () => {
    const gate = new PasswordWorkGate(2);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const first = gate.run(() => pending);
    const second = gate.run(() => pending);
    const excess = vi.fn(async () => "unexpected");
    await expect(gate.run(excess)).rejects.toMatchObject({ status: 503 });
    expect(excess).not.toHaveBeenCalled();
    release();
    await Promise.all([first, second]);
    expect(await gate.run(async () => "accepted")).toBe("accepted");
  });

  it("releases slots when hashing fails", async () => {
    const gate = new PasswordWorkGate(1);
    await expect(gate.run(async () => { throw new Error("failure"); })).rejects.toThrow("failure");
    await expect(gate.run(async () => true)).resolves.toBe(true);
  });
});

describe("origin and recovery configuration", () => {
  it("requires a configured HTTPS origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "");
    expect(() => appOrigin()).toThrow(/required/);
    for (const value of ["http://brightloop.test", "https://user:pass@brightloop.test", "https://brightloop.test/path"]) {
      vi.stubEnv("APP_ORIGIN", value);
      expect(() => appOrigin()).toThrow();
    }
    vi.stubEnv("APP_ORIGIN", "https://brightloop.test");
    expect(appOrigin()).toBe("https://brightloop.test");
  });

  it("requires an explicit local-development mailer opt-in", () => {
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DEV_MAILER", "");
    expect(devMailerEnabled()).toBe(false);
    vi.stubEnv("AUTH_DEV_MAILER", "1");
    expect(devMailerEnabled()).toBe(true);
    for (const environment of ["test", "staging", "production", ""]) {
      vi.stubEnv("NODE_ENV", environment);
      expect(devMailerEnabled()).toBe(false);
    }
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "https://demo.example.com");
    expect(devMailerEnabled()).toBe(false);
  });

  it("rejects production cookie mutations with missing origin evidence", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://brightloop.test");
    const request = (headers: Record<string, string>) => new Request("https://brightloop.test/api/payments", {
      method: "POST", headers: { cookie: "a=b", ...headers },
    });
    expect(() => assertSameOrigin(request({}))).toThrow(/Cross-origin/);
    expect(() => assertSameOrigin(request({ "sec-fetch-site": "same-site" }))).toThrow(/Cross-origin/);
    expect(() => assertSameOrigin(request({ origin: "https://brightloop.test" }))).not.toThrow();
    expect(() => assertSameOrigin(request({ "sec-fetch-site": "same-origin" }))).not.toThrow();
  });
});

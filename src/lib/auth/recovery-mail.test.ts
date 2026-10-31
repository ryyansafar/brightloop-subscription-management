import { createHash } from "node:crypto";
import { compare } from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/factory";
import { requestPasswordReset, resetPassword } from "./password-reset";
import { recoveryMailAvailable } from "./recovery-mail";
import { POST as forgot } from "@/app/(auth)/api/auth/forgot-password/route";

const request = vi.fn<typeof fetch>();
const email = "recovery@example.com";
let sequence = 0;

beforeEach(async () => {
  await resetDb();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ORIGIN", "https://brightloop.example");
  vi.stubEnv("EMAIL_PROVIDER", "resend");
  vi.stubEnv("RESEND_API_KEY", "re_test_only_key");
  vi.stubEnv("EMAIL_FROM", "accounts@example.com");
  vi.stubEnv("AUTH_DEV_MAILER", "1");
  request.mockReset().mockImplementation(async () => Response.json({ id: "recovery-email" }));
  vi.stubGlobal("fetch", request);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await db.user.create({ data: { email, name: "Customer", role: "CUSTOMER", passwordHash: "unused-before-reset" } });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const recover = (address = email) => requestPasswordReset({ email: address }, `mail-test-${++sequence}`);
function submittedLink() {
  const body = JSON.parse(request.mock.calls[0][1]!.body as string);
  return new URL(body.text.match(/https:\/\/[^\s]+/)[0]);
}

describe("real password recovery mail", () => {
  it("emails a usable single-use reset link without exposing it in the response or logs", async () => {
    expect(recoveryMailAvailable()).toBe(true);
    expect(await recover()).toEqual({});
    const url = submittedLink();
    expect(url.origin).toBe("https://brightloop.example");
    const token = url.searchParams.get("token")!;
    const record = await db.passwordReset.findFirstOrThrow();
    expect(record.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(record.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 60_000);
    expect(console.info).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    await resetPassword({ token, password: "ChangedPassword@123" });
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(await compare("ChangedPassword@123", user.passwordHash)).toBe(true);
    await expect(resetPassword({ token, password: "AnotherPassword@123" })).rejects.toThrow(/invalid or expired/);
  });

  it("uses a generic result for unknown accounts without sending mail or issuing tokens", async () => {
    expect(await recover("missing@example.com")).toEqual({});
    expect(request).not.toHaveBeenCalled();
    expect(await db.passwordReset.count()).toBe(0);
  });

  it("invalidates an undelivered token and keeps provider failures indistinguishable from unknown accounts", async () => {
    request.mockImplementation(async () => Response.json({ message: "private detail" }, { status: 403 }));
    const failed = await recover();
    expect(failed).toEqual(await recover("missing@example.com"));
    expect(console.error).toHaveBeenCalledWith("Password recovery email delivery failed");
    const record = await db.passwordReset.findFirstOrThrow();
    expect(record.usedAt).not.toBeNull();
    await expect(resetPassword({ token: submittedLink().searchParams.get("token"), password: "ChangedPassword@123" })).rejects.toThrow(/invalid or expired/);
  });

  it("does not fall back to console disclosure when Resend is selected but misconfigured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(recoveryMailAvailable()).toBe(false);
    await expect(recover()).rejects.toThrow(/not configured/);
    expect(console.info).not.toHaveBeenCalled();
    expect(await db.passwordReset.count()).toBe(0);
  });

  it("keeps the public API confirmation and cache headers identical for success, unknown user and delivery failure", async () => {
    vi.stubEnv("AUTH_TRUSTED_IP_HEADER", "x-test-client-ip");
    const call = (address: string) => forgot(new Request("https://brightloop.example/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://brightloop.example", "x-test-client-ip": "192.0.2.185" },
      body: JSON.stringify({ email: address }),
    }));
    const sent = await call(email);
    expect(sent.status).toBe(200);
    expect(sent.headers.get("cache-control")).toBe("no-store");
    const confirmation = await sent.json();
    expect(confirmation.data.devResetUrl).toBeUndefined();
    expect(await (await call("missing@example.com")).json()).toEqual(confirmation);
    request.mockRejectedValueOnce(new DOMException("Request timed out", "TimeoutError"));
    const failed = await call(email);
    expect(failed.status).toBe(200);
    expect(await failed.json()).toEqual(confirmation);
  });
});

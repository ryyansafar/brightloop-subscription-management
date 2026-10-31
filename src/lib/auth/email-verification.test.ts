import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/factory";
import { POST as signup } from "@/app/(auth)/api/auth/signup/route";
import { POST as login } from "@/app/(auth)/api/auth/login/route";
import { POST as verify } from "@/app/(auth)/api/auth/verify-email/route";
import { POST as resend } from "@/app/(auth)/api/auth/resend-verification/route";
import { getSessionUser, createSession, SESSION_COOKIE } from "./session";
import { drainMailOutbox } from "@/lib/mail-outbox";

const email = "verify@example.com";
const password = "Verification@123";
const request = (body: unknown) => new Request("http://localhost:3000/api/auth/test", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", "x-client-ip": "192.0.2.200" }, body: JSON.stringify(body) });
const tokenFrom = (url: string) => new URLSearchParams(new URL(url).hash.slice(1)).get("token")!;
const register = () => signup(request({ name: "Customer", email, password }));

beforeEach(async () => {
  await resetDb();
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("AUTH_REQUIRE_EMAIL_VERIFICATION", "1");
  vi.stubEnv("AUTH_DEV_MAILER", "1"); vi.stubEnv("EMAIL_PROVIDER", "disabled");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000"); vi.stubEnv("AUTH_TRUSTED_IP_HEADER", "x-client-ip");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("email ownership verification", () => {
  it("withholds the session until a single-use email link is confirmed, then permits login", async () => {
    const registered = await register();
    expect(registered.status).toBe(201);
    expect(registered.headers.get("set-cookie")).toBeNull();
    const body = await registered.json();
    expect(body.data.verificationRequired).toBe(true);
    const token = tokenFrom(body.data.devVerificationUrl);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(await getSessionUser(new Request("http://localhost", { headers: { cookie: `${SESSION_COOKIE}=${createSession(user)}` } }))).toBeNull();
    expect((await login(request({ email, password }))).status).toBe(403);
    expect((await verify(request({ token }))).status).toBe(200);
    expect((await verify(request({ token }))).status).toBe(400);
    const signedIn = await login(request({ email, password }));
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.get("set-cookie")).toContain(SESSION_COOKIE);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).emailVerifiedAt).not.toBeNull();
  });

  it("expires links and invalidates a superseded verification token", async () => {
    const first = tokenFrom((await (await register()).json()).data.devVerificationUrl);
    await db.emailVerification.updateMany({ data: { expiresAt: new Date(0) } });
    expect((await verify(request({ token: first }))).status).toBe(400);
    const second = tokenFrom((await (await resend(request({ email }))).json()).data.devVerificationUrl);
    const third = tokenFrom((await (await resend(request({ email }))).json()).data.devVerificationUrl);
    expect((await verify(request({ token: second }))).status).toBe(400);
    expect((await verify(request({ token: third }))).status).toBe(200);
  });

  it("binds verification to the original email address", async () => {
    const token = tokenFrom((await (await register()).json()).data.devVerificationUrl);
    await db.user.update({ where: { email }, data: { email: "changed@example.com" } });
    expect((await verify(request({ token }))).status).toBe(400);
    expect((await db.user.findFirstOrThrow()).emailVerifiedAt).toBeNull();
  });

  it("fails before creating an account when verification mail is unavailable", async () => {
    vi.stubEnv("AUTH_DEV_MAILER", "0");
    expect((await register()).status).toBe(503);
    expect(await db.user.count()).toBe(0);
  });

  it("keeps real tokens out of responses/logs and skips superseded queued messages", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend"); vi.stubEnv("EMAIL_FROM", "accounts@example.com"); vi.stubEnv("RESEND_API_KEY", "re_verification_test");
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({}, { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    const result = await (await register()).json();
    expect(result.data.devVerificationUrl).toBeUndefined();
    expect(console.info).not.toHaveBeenCalled();
    const known = await (await resend(request({ email }))).json();
    const unknown = await (await resend(request({ email: "missing@example.com" }))).json();
    expect(known).toEqual(unknown);
    const firstJob = await db.mailOutbox.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    expect(firstJob.payload).not.toContain(email);
    await db.mailOutbox.update({ where: { id: firstJob.id }, data: { nextAttemptAt: new Date(0) } });
    fetcher.mockClear();
    await drainMailOutbox();
    expect(fetcher).not.toHaveBeenCalled();
    expect((await db.mailOutbox.findUniqueOrThrow({ where: { id: firstJob.id } })).status).toBe("FAILED");
  });

  it("allows only one concurrent token consumption", async () => {
    const token = tokenFrom((await (await register()).json()).data.devVerificationUrl);
    const results = await Promise.all([verify(request({ token })), verify(request({ token }))]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
  });
});

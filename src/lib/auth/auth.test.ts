import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { resetDb } from "@/test/factory";
import { POST as signup } from "@/app/(auth)/api/auth/signup/route";
import { POST as login } from "@/app/(auth)/api/auth/login/route";
import { POST as logout } from "@/app/(auth)/api/auth/logout/route";
import { GET as me } from "@/app/(auth)/api/auth/me/route";
import { POST as forgot } from "@/app/(auth)/api/auth/forgot-password/route";
import { POST as reset } from "@/app/(auth)/api/auth/reset-password/route";
import { POST as createStaff } from "@/app/admin/staff/accounts/route";
import { createSession, getSessionUser, SESSION_COOKIE } from "./session";
import { resolveUser } from "@/lib/api-auth";

let sequence = 0;
let email: string;
const password = "Customer@123";
const req = (body?: unknown, cookie?: string, path = "/api/auth/signup") => new Request(`http://localhost${path}`, {
  method: body === undefined ? "GET" : "POST",
  headers: { "Content-Type": "application/json", "x-test-client-ip": `192.0.2.${sequence}`, ...(cookie ? { cookie } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const cookieFrom = (response: Response) => response.headers.get("set-cookie")!.split(";")[0];
const credentials = () => ({ name: "Test Customer", email, password });
async function signUp() { return signup(req(credentials())); }
async function resetToken() {
  const response = await forgot(req({ email }));
  const body = await response.json();
  return new URL(body.data.devResetUrl).searchParams.get("token")!;
}

beforeEach(async () => {
  await resetDb();
  email = `auth-${++sequence}@test.dev`;
  vi.stubEnv("AUTH_SESSION_SECRET", "test-secret-with-at-least-32-characters");
  vi.stubEnv("AUTH_DEV_BYPASS", "0");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("AUTH_DEV_MAILER", "1");
  vi.stubEnv("EMAIL_PROVIDER", "disabled");
  vi.stubEnv("AUTH_TRUSTED_IP_HEADER", "x-test-client-ip");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("account routes", () => {
  it("creates a linked customer atomically, hashes the password, and issues a cookie", async () => {
    const response = await signUp();
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.role).toBe("CUSTOMER");
    expect(body.data.passwordHash).toBeUndefined();
    const user = await db.user.findUniqueOrThrow({ where: { email }, include: { customer: true } });
    expect(user.customer?.email).toBe(email);
    expect(user.passwordHash).not.toBe(password);
    expect(await compare(password, user.passwordHash)).toBe(true);
    expect((await me(req(undefined, cookieFrom(response)))).status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects duplicate normalized email without creating an orphan customer", async () => {
    await signUp();
    const response = await signup(req({ ...credentials(), email: ` ${email.toUpperCase()} ` }));
    expect(response.status).toBe(409);
    expect(await db.customer.count()).toBe(1);
  });

  it("rejects role escalation and gives readable password errors", async () => {
    expect((await signup(req({ ...credentials(), role: "ADMIN" }))).status).toBe(400);
    const response = await signup(req({ ...credentials(), password: "short" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Password must be longer than 8 characters");
    expect(await db.user.count()).toBe(0);
  });

  it("does not create an account when the signing key is missing", async () => {
    vi.stubEnv("AUTH_SESSION_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await signUp()).status).toBe(500);
    expect(await db.user.count()).toBe(0);
  });

  it("logs in with normalized email and rejects wrong credentials uniformly", async () => {
    await signUp();
    const success = await login(req({ email: ` ${email.toUpperCase()} `, password }));
    expect(success.status).toBe(200);
    expect((await me(req(undefined, cookieFrom(success)))).status).toBe(200);
    const wrong = await login(req({ email, password: "wrong" }));
    const unknown = await login(req({ email: "unknown@test.dev", password: "wrong" }));
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it("clears the browser cookie on logout and rejects unauthenticated profile reads", async () => {
    const response = await logout(req({}));
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await me(req())).status).toBe(401);
  });

  it("returns JSON errors for malformed bodies and hostile origins", async () => {
    expect((await signup(new Request("http://localhost/api/auth/signup", {
      method: "POST", body: "{", headers: { "content-type": "application/json", "x-test-client-ip": `192.0.2.${sequence}` },
    }))).status).toBe(400);
    expect((await signup(new Request("http://localhost/api/auth/signup", {
      method: "POST", headers: { origin: "https://evil.test" }, body: JSON.stringify(credentials()),
    }))).status).toBe(403);
  });

  it("uses live database roles and rejects deleted users or changed passwords", async () => {
    const response = await signUp();
    const request = req(undefined, cookieFrom(response));
    await db.user.update({ where: { email }, data: { role: "STAFF" } });
    expect((await getSessionUser(request))?.role).toBe("STAFF");
    await db.user.update({ where: { email }, data: { passwordHash: await hash("Changed@123", 4) } });
    expect(await getSessionUser(request)).toBeNull();
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const fresh = req(undefined, `${SESSION_COOKIE}=${createSession(user)}`);
    await db.customer.deleteMany();
    await db.user.delete({ where: { email } });
    expect(await getSessionUser(fresh)).toBeNull();
  });

  it.each(["development", "production"])("ignores forged header identities in %s", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    vi.stubEnv("AUTH_DEV_BYPASS", "1");
    expect(await resolveUser(new Request("http://localhost/api/invoices", {
      headers: { "x-dev-role": "ADMIN", "x-dev-user-id": "1" },
    }))).toBeNull();
  });

  it("fails closed for an unrecognized database role", async () => {
    const cookie = cookieFrom(await signUp());
    await db.user.update({ where: { email }, data: { role: "UNKNOWN" } });
    expect((await me(req(undefined, cookie))).status).toBe(401);
  });

  it("ignores identity headers in a test-labelled server outside Vitest", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_DEV_BYPASS", "1");
    vi.stubEnv("VITEST", "");
    expect(await resolveUser(new Request("http://localhost/api/invoices", {
      headers: { "x-dev-role": "ADMIN", "x-dev-user-id": "1" },
    }))).toBeNull();
  });

  it("ignores duplicate session cookies rather than choosing an attacker-controlled one", async () => {
    const cookie = cookieFrom(await signUp());
    expect((await me(req(undefined, `${cookie}; ${cookie}`))).status).toBe(401);
  });

  it("uses only the __Host- cookie name in production", async () => {
    await signUp();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://brightloop.test");
    const response = await login(req({ email, password }));
    expect(response.status).toBe(200);
    const cookie = cookieFrom(response);
    expect(cookie).toMatch(/^__Host-brightloop_session=/);
    expect((await me(req(undefined, cookie))).status).toBe(200);
    expect((await me(req(undefined, cookie.replace("__Host-", "")))).status).toBe(401);
  });

  it("limits rotating-email requests before account creation and preserves other sources", async () => {
    for (let i = 0; i < 40; i++) {
      const response = await signup(req({ name: "Probe", email: `rotate-${i}@test.dev`, password: "weak" }));
      expect(response.status).toBe(400);
    }
    const blocked = await signup(req(credentials()));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("900");
    expect(await db.user.count()).toBe(0);
    const separateSource = req(credentials());
    separateSource.headers.set("x-test-client-ip", "198.51.100.2");
    expect((await signup(separateSource)).status).toBe(201);
  });
});

describe("password recovery", () => {
  it("does not issue or disclose reset links without the explicit development opt-in", async () => {
    await signUp();
    vi.stubEnv("AUTH_DEV_MAILER", "");
    expect((await forgot(req({ email }))).status).toBe(503);
    expect(console.info).not.toHaveBeenCalled();
    expect(await db.passwordReset.count()).toBe(0);
  });

  it("stores only a token hash and returns/logs the dev link", async () => {
    await signUp();
    const token = await resetToken();
    const record = await db.passwordReset.findFirstOrThrow();
    expect(record.tokenHash).not.toBe(token);
    expect(record.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 60_000);
    expect(console.info).toHaveBeenCalledOnce();
  });

  it("replaces the password once, invalidates old sessions, and requires login again", async () => {
    const old = cookieFrom(await signUp());
    const token = await resetToken();
    const response = await reset(req({ token, password: "Changed@123" }));
    expect(response.status).toBe(200);
    expect((await me(req(undefined, old))).status).toBe(401);
    expect((await login(req({ email, password }))).status).toBe(401);
    expect((await login(req({ email, password: "Changed@123" }))).status).toBe(200);
    expect((await reset(req({ token, password: "Another@123" }))).status).toBe(400);
  });

  it("rejects expired, missing and malformed tokens", async () => {
    await signUp();
    const token = await resetToken();
    await db.passwordReset.updateMany({ data: { expiresAt: new Date(0) } });
    for (const value of [token, "f".repeat(64), "bad"]) {
      expect((await reset(req({ token: value, password: "Changed@123" }))).status).toBe(400);
    }
  });

  it("invalidates previous reset links and rejects weak replacements", async () => {
    await signUp();
    const first = await resetToken();
    const second = await resetToken();
    expect((await reset(req({ token: first, password: "Changed@123" }))).status).toBe(400);
    expect((await reset(req({ token: second, password: "weak" }))).status).toBe(400);
    expect((await reset(req({ token: second, password: "Changed@123" }))).status).toBe(200);
  });

  it("consumes a token at most once under concurrent requests", async () => {
    await signUp();
    const token = await resetToken();
    const results = await Promise.all([
      reset(req({ token, password: "FirstNew@123" })), reset(req({ token, password: "SecondNew@123" })),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 400]);
  });

  it("does not disclose unknown accounts or log links in production", async () => {
    const unknown = await forgot(req({ email }));
    expect(unknown.status).toBe(200);
    expect((await unknown.json()).data.devResetUrl).toBeUndefined();
    await signUp();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://brightloop.test");
    expect((await forgot(req({ email }))).status).toBe(503);
    expect(console.info).not.toHaveBeenCalled();
    expect(await db.passwordReset.count()).toBe(0);
  });
});

describe("staff creation", () => {
  it("requires an admin and creates STAFF without replacing the admin session", async () => {
    const cookie = cookieFrom(await signUp());
    const staff = { name: "New Staff", email: "new-staff@test.dev", password: "StaffPass@123" };
    expect((await createStaff(req(staff))).status).toBe(401);
    expect((await createStaff(req(staff, cookie))).status).toBe(403);
    await db.user.update({ where: { email }, data: { role: "STAFF" } });
    expect((await createStaff(req(staff, cookie))).status).toBe(403);
    await db.user.update({ where: { email }, data: { role: "ADMIN" } });
    const response = await createStaff(req(staff, cookie));
    expect(response.status).toBe(201);
    expect((await response.json()).data.role).toBe("STAFF");
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(await db.customer.count()).toBe(1);
    expect((await login(req({ email: staff.email, password: staff.password }))).status).toBe(200);
  });
});

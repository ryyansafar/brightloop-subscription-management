import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resetDb, seedSubscription, utc } from "@/test/factory";
import { runBilling } from "@/lib/billing";
import { GET as listInvoices } from "@/app/api/invoices/route";
import { GET as getInvoice } from "@/app/api/invoices/[id]/route";
import { GET as listSubscriptions } from "@/app/api/subscriptions/route";
import { GET as getSubscription } from "@/app/api/subscriptions/[id]/route";
import { POST as transition } from "@/app/api/subscriptions/[id]/transition/route";
import { POST as renew } from "@/app/api/subscriptions/[id]/renew/route";
import { POST as billing } from "@/app/api/billing/run/route";
import { proxy } from "@/proxy";
import { createSession, SESSION_COOKIE } from "./session";

beforeEach(async () => {
  await resetDb();
  vi.stubEnv("AUTH_DEV_BYPASS", "0");
  vi.stubEnv("AUTH_SESSION_SECRET", "test-secret-with-at-least-32-characters");
});
afterEach(() => vi.unstubAllEnvs());
const context = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

async function identity(role = "CUSTOMER") {
  const user = await db.user.create({ data: {
    name: "Portal User", email: `${role.toLowerCase()}@test.dev`, passwordHash: "test-hash", role,
  } });
  const cookie = `${SESSION_COOKIE}=${createSession(user)}`;
  const request = (path: string, body?: unknown) => new Request(`http://localhost${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { user, cookie, request };
}

describe("portal APIs with real signed sessions", () => {
  it("scopes lists and refuses another customer's invoice and subscription IDs", async () => {
    const mine = await seedSubscription();
    const other = await seedSubscription();
    const { user, request } = await identity();
    await db.customer.update({ where: { id: mine.customer.id }, data: { userId: user.id } });
    await runBilling(utc("2026-01-15"));
    const invoice = await db.invoice.findFirstOrThrow({ where: { customerId: other.customer.id } });
    expect((await (await listInvoices(request("/api/invoices"))).json()).data.total).toBe(1);
    const list = await listSubscriptions(request(`/api/subscriptions?customerId=${other.customer.id}`));
    expect((await list.json()).data.items.map((item: { id: number }) => item.id)).toEqual([mine.subscription.id]);
    expect((await getInvoice(request(`/api/invoices/${invoice.id}`), context(invoice.id))).status).toBe(404);
    expect((await getSubscription(request(`/api/subscriptions/${other.subscription.id}`), context(other.subscription.id))).status).toBe(404);
  });

  it("allows close and renew only for owned subscriptions", async () => {
    const mine = await seedSubscription({ end: "2026-02-15" });
    const other = await seedSubscription({ end: "2026-02-15" });
    const { user, request } = await identity();
    await db.customer.update({ where: { id: mine.customer.id }, data: { userId: user.id } });
    const renewResponse = await renew(request(`/api/subscriptions/${mine.subscription.id}/renew`, {}), context(mine.subscription.id));
    expect(renewResponse.status).toBe(200);
    expect((await renewResponse.json()).data.endDate).toBe("2026-03-15T00:00:00.000Z");
    expect((await renew(request(`/api/subscriptions/${other.subscription.id}/renew`, {}), context(other.subscription.id))).status).toBe(404);
    expect((await transition(request(`/api/subscriptions/${other.subscription.id}/transition`, { to: "CLOSED", closeReason: "Leaving" }), context(other.subscription.id))).status).toBe(404);
    expect((await transition(request(`/api/subscriptions/${mine.subscription.id}/transition`, { to: "PAUSED" }), context(mine.subscription.id))).status).toBe(403);
    expect((await transition(request(`/api/subscriptions/${mine.subscription.id}/transition`, { to: "CLOSED", closeReason: "Leaving" }), context(mine.subscription.id))).status).toBe(200);
  });

  it("returns empty data for an account with no linked customer", async () => {
    await seedSubscription();
    const { request } = await identity();
    expect((await (await listSubscriptions(request("/api/subscriptions"))).json()).data.total).toBe(0);
  });

  it("enforces admin billing permissions with real cookies", async () => {
    const staff = await identity("STAFF");
    expect((await billing(staff.request("/api/billing/run", {}))).status).toBe(403);
    const admin = await identity("ADMIN");
    expect((await billing(admin.request("/api/billing/run", {}))).status).toBe(200);
  });
});

describe("page proxy", () => {
  it("redirects unsigned requests to login with an internal return path", async () => {
    const response = await proxy(new NextRequest("http://localhost/subscriptions?status=ACTIVE"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/subscriptions?status=ACTIVE");
  });

  it("keeps customers in the portal and staff out of admin pages", async () => {
    const customer = await identity();
    const request = (path: string, cookie: string) => new NextRequest(`http://localhost${path}`, { headers: { cookie } });
    expect((await proxy(request("/invoices", customer.cookie))).headers.get("location")).toBe("http://localhost/portal");
    expect((await proxy(request("/portal", customer.cookie))).headers.get("x-middleware-next")).toBe("1");
    const staff = await identity("STAFF");
    expect((await proxy(request("/admin/staff", staff.cookie))).headers.get("location")).toBe("http://localhost/dashboard");
    const admin = await identity("ADMIN");
    expect((await proxy(request("/admin/staff", admin.cookie))).headers.get("x-middleware-next")).toBe("1");
  });

  it("lets staff mutation handlers return their own JSON authorization errors", async () => {
    const response = await proxy(new NextRequest("http://localhost/admin/staff/accounts", { method: "POST" }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

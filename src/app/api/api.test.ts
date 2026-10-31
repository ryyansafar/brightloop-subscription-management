import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { runBilling } from "@/lib/billing";
import { confirmInvoice } from "@/lib/invoices";
import { resetDb, seedSubscription, utc } from "@/test/factory";
import { GET as listInvoices } from "@/app/api/invoices/route";
import { GET as getInvoice } from "@/app/api/invoices/[id]/route";
import { POST as invoiceAction } from "@/app/api/invoices/[id]/[action]/route";
import { POST as runBillingRoute } from "@/app/api/billing/run/route";
import { POST as postPayment } from "@/app/api/payments/route";
import { POST as transition } from "@/app/api/subscriptions/[id]/transition/route";

function req(url: string, init: { role?: string; userId?: number; body?: unknown } = {}): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.role) headers["x-dev-role"] = init.role;
  if (init.userId) headers["x-dev-user-id"] = String(init.userId);
  return new Request(`http://localhost${url}`, {
    method: init.body === undefined ? "GET" : "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const ctx = <P extends Record<string, string>>(params: P) => ({ params: Promise.resolve(params) });
interface ApiBody {
  ok: boolean;
  data?: { invoicesCreated?: number; total?: number; invoiceStatus?: string };
  error?: string;
}
const json = async (res: Response) => (await res.json()) as ApiBody;

beforeEach(resetDb);

describe("API access control", () => {
  it("returns 401 when not signed in", async () => {
    expect((await listInvoices(req("/api/invoices"))).status).toBe(401);
  });

  it("blocks staff from running billing but allows admin", async () => {
    await seedSubscription();
    const staff = await runBillingRoute(req("/api/billing/run", { role: "STAFF", userId: 1, body: {} }));
    expect(staff.status).toBe(403);

    const admin = await runBillingRoute(
      req("/api/billing/run", { role: "ADMIN", userId: 1, body: { asOf: "2026-01-15" } }),
    );
    const body = await json(admin);
    expect(admin.status).toBe(200);
    expect(body.data?.invoicesCreated).toBe(1);
  });

  it("lets a customer see only their own invoices", async () => {
    const mine = await seedSubscription();
    await seedSubscription();
    const user = await db.user.create({
      data: { email: "mine@test.dev", passwordHash: "x", name: "Mine", role: "CUSTOMER" },
    });
    await db.customer.update({ where: { id: mine.customer.id }, data: { userId: user.id } });
    await runBilling(utc("2026-01-15"));

    const res = await json(await listInvoices(req("/api/invoices", { role: "CUSTOMER", userId: user.id })));
    expect(res.data?.total).toBe(1);

    const other = await db.invoice.findFirstOrThrow({ where: { customerId: { not: mine.customer.id } } });
    const peek = await getInvoice(
      req(`/api/invoices/${other.id}`, { role: "CUSTOMER", userId: user.id }),
      ctx({ id: String(other.id) }),
    );
    expect(peek.status).toBe(404);
  });

  it("lets a customer close only their own subscription", async () => {
    const mine = await seedSubscription();
    const user = await db.user.create({
      data: { email: "c@test.dev", passwordHash: "x", name: "C", role: "CUSTOMER" },
    });
    await db.customer.update({ where: { id: mine.customer.id }, data: { userId: user.id } });
    const call = (body: unknown) =>
      transition(
        req(`/api/subscriptions/${mine.subscription.id}/transition`, {
          role: "CUSTOMER",
          userId: user.id,
          body,
        }),
        ctx({ id: String(mine.subscription.id) }),
      );

    expect((await call({ to: "PAUSED" })).status).toBe(403);
    const closed = await call({ to: "CLOSED", closeReason: "Switching provider" });
    expect(closed.status).toBe(200);

    const stranger = await seedSubscription();
    const denied = await transition(
      req(`/api/subscriptions/${stranger.subscription.id}/transition`, {
        role: "CUSTOMER",
        userId: user.id,
        body: { to: "CLOSED", closeReason: "x" },
      }),
      ctx({ id: String(stranger.subscription.id) }),
    );
    expect(denied.status).toBe(404);
  });
});

describe("API validation and errors", () => {
  it("returns readable validation errors", async () => {
    const res = await postPayment(
      req("/api/payments", { role: "STAFF", userId: 1, body: { invoiceId: 1, method: "CASH", amount: -5 } }),
    );
    const body = await json(res);
    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/amount/i);
  });

  it("walks confirm then payment through the API", async () => {
    await seedSubscription();
    await runBilling(utc("2026-01-15"));
    const invoice = await db.invoice.findFirstOrThrow();

    const confirm = await invoiceAction(
      req(`/api/invoices/${invoice.id}/confirm`, { role: "STAFF", userId: 1, body: {} }),
      ctx({ id: String(invoice.id), action: "confirm" }),
    );
    expect(confirm.status).toBe(200);

    const over = await postPayment(
      req("/api/payments", {
        role: "STAFF",
        userId: 1,
        body: { invoiceId: invoice.id, method: "CARD", amount: invoice.total + 1 },
      }),
    );
    expect(over.status).toBe(409);

    const paid = await json(
      await postPayment(
        req("/api/payments", {
          role: "STAFF",
          userId: 1,
          body: { invoiceId: invoice.id, method: "CARD", amount: invoice.total },
        }),
      ),
    );
    expect(paid.data?.invoiceStatus).toBe("PAID");
  });

  it("rejects an unknown invoice action", async () => {
    await seedSubscription();
    await runBilling(utc("2026-01-15"));
    const invoice = await db.invoice.findFirstOrThrow();
    await confirmInvoice(invoice.id);
    const res = await invoiceAction(
      req(`/api/invoices/${invoice.id}/delete`, { role: "ADMIN", userId: 1, body: {} }),
      ctx({ id: String(invoice.id), action: "delete" }),
    );
    expect(res.status).toBe(404);
  });
});

describe("billing preview", () => {
  it("lets only the admin preview how many subscriptions are due", async () => {
    const { GET: previewBilling } = await import("@/app/api/billing/run/route");
    await seedSubscription();
    const staff = await previewBilling(req("/api/billing/run?asOf=2026-01-20", { role: "STAFF", userId: 1 }));
    expect(staff.status).toBe(403);
    const admin = await previewBilling(req("/api/billing/run?asOf=2026-01-20", { role: "ADMIN", userId: 1 }));
    expect(admin.status).toBe(200);
    expect(((await admin.json()) as { data: { due: number } }).data.due).toBe(1);
    const bad = await previewBilling(req("/api/billing/run?asOf=not-a-date", { role: "ADMIN", userId: 1 }));
    expect(bad.status).toBe(400);
  });
});

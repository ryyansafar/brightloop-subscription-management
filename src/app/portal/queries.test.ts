import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb, seedSubscription, utc } from "@/test/factory";
import { runBilling } from "@/lib/billing";
import { requirePageRole } from "@/lib/auth/current-user";
import { subscriptionDetail, subscriptionList, subscriptionOptions } from "@/app/(app)/subscriptions/queries";
import { portalInvoiceDetail, portalInvoices, portalOverview } from "./queries";

vi.mock("@/lib/auth/current-user", () => ({ requirePageRole: vi.fn() }));

beforeEach(async () => {
  await resetDb();
  vi.mocked(requirePageRole).mockReset();
});

describe("server-rendered page data authorization", () => {
  async function customerSetup() {
    const mine = await seedSubscription();
    const other = await seedSubscription();
    const user = await db.user.create({ data: { email: "portal@test.dev", name: "Portal", role: "CUSTOMER", passwordHash: "not-used-in-this-data-test" } });
    await db.customer.update({ where: { id: mine.customer.id }, data: { userId: user.id } });
    vi.mocked(requirePageRole).mockImplementation(async (roles) => {
      if (!roles.includes("CUSTOMER")) throw new Error("Access denied");
      return { id: user.id, role: "CUSTOMER", email: user.email, name: user.name };
    });
    return { mine, other };
  }

  it("scopes subscription cards, summaries and nested detail invoices to the current customer", async () => {
    const { mine, other } = await customerSetup();
    await runBilling(utc("2026-01-15"));
    const ownInvoice = await db.invoice.findFirstOrThrow({ where: { customerId: mine.customer.id } });
    await db.invoice.updateMany({ data: { status: "CONFIRMED" } });
    await db.payment.create({ data: { invoiceId: ownInvoice.id, amount: 100, method: "CASH", paidOn: utc("2026-01-16") } });
    const overview = await portalOverview({});
    expect(overview.rows.map((row) => row.id)).toEqual([mine.subscription.id]);
    expect(overview.active).toBe(1);
    expect(overview.outstanding).toBe(ownInvoice.total - 100);
    expect((await subscriptionDetail(mine.subscription.id))?.invoices.map((row) => row.id)).toEqual([ownInvoice.id]);
    expect(await subscriptionDetail(other.subscription.id)).toBeNull();
  });

  it("does not expose another customer's printable invoice", async () => {
    const { mine, other } = await customerSetup();
    await runBilling(utc("2026-01-15"));
    const otherInvoice = await db.invoice.findFirstOrThrow({ where: { customerId: other.customer.id } });
    expect(await portalInvoiceDetail(otherInvoice.id)).toBeNull();
    const list = await portalInvoices({});
    expect(list.total).toBe(1);
    expect(list.rows[0].customerId).toBe(mine.customer.id);
  });

  it("rejects customer access to staff form options and team lists", async () => {
    await customerSetup();
    await expect(subscriptionOptions()).rejects.toThrow("Access denied");
    await expect(subscriptionList({})).rejects.toThrow("Access denied");
  });
});

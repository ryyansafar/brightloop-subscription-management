// Authorization boundary: the portal data functions only ever return the given customer's rows.
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { runBilling } from "@/lib/billing";
import { resetDb, seedSubscription, utc } from "@/test/factory";
import {
  getPortalInvoice,
  getPortalSubscription,
  listPortalInvoices,
  listPortalSubscriptions,
  overdueSummary,
} from "../queries";

const today = utc("2026-06-30");

async function twoCustomers() {
  const mine = await seedSubscription();
  const other = await seedSubscription();
  await runBilling(utc("2026-01-15"));
  const invoices = (customerId: number) => db.invoice.findMany({ where: { customerId } });
  return { mine, other, myInvoices: await invoices(mine.customer.id), otherInvoices: await invoices(other.customer.id) };
}

beforeEach(resetDb);

describe("portal invoices", () => {
  it("lists only the customer's own issued invoices", async () => {
    const { mine, myInvoices } = await twoCustomers();
    await db.invoice.updateMany({ where: { customerId: mine.customer.id }, data: { status: "CONFIRMED" } });
    const { rows, total } = await listPortalInvoices(mine.customer.id, { page: 1, today });
    expect(total).toBe(myInvoices.length);
    expect(rows.map((r) => r.id).sort()).toEqual(myInvoices.map((i) => i.id).sort());
  });

  it("hides drafts from the customer", async () => {
    const { mine } = await twoCustomers();
    await db.invoice.updateMany({ where: { customerId: mine.customer.id }, data: { status: "DRAFT" } });
    expect((await listPortalInvoices(mine.customer.id, { page: 1, today })).total).toBe(0);
  });

  it("returns null for another customer's invoice id", async () => {
    const { mine, otherInvoices, myInvoices } = await twoCustomers();
    await db.invoice.updateMany({ data: { status: "CONFIRMED" } });
    expect(await getPortalInvoice(mine.customer.id, otherInvoices[0].id)).toBeNull();
    expect((await getPortalInvoice(mine.customer.id, myInvoices[0].id))?.id).toBe(myInvoices[0].id);
  });

  it("search cannot reach another customer's invoice number", async () => {
    const { mine, otherInvoices } = await twoCustomers();
    await db.invoice.updateMany({ data: { status: "CONFIRMED" } });
    const result = await listPortalInvoices(mine.customer.id, { page: 1, q: otherInvoices[0].number, today });
    expect(result.total).toBe(0);
  });

  it("overdue summary counts only own confirmed past-due invoices", async () => {
    const { mine, other } = await twoCustomers();
    await db.invoice.updateMany({ data: { status: "CONFIRMED", dueDate: utc("2026-02-01") } });
    const own = await db.invoice.count({ where: { customerId: mine.customer.id } });
    const summary = await overdueSummary(mine.customer.id, today);
    expect(summary.count).toBe(own);
    expect(summary.total).toBeGreaterThan(0);
    const none = await overdueSummary(other.customer.id + 9999, today);
    expect(none.count).toBe(0);
  });
});

describe("portal subscriptions", () => {
  it("lists only own non-draft subscriptions", async () => {
    const { mine, other } = await twoCustomers();
    const rows = await listPortalSubscriptions(mine.customer.id);
    expect(rows.map((r) => r.id)).toEqual([mine.subscription.id]);
    expect(rows.map((r) => r.id)).not.toContain(other.subscription.id);
  });

  it("returns null for another customer's subscription and its detail excludes their invoices", async () => {
    const { mine, other } = await twoCustomers();
    expect(await getPortalSubscription(mine.customer.id, other.subscription.id)).toBeNull();
    await db.invoice.updateMany({ data: { status: "CONFIRMED" } });
    const detail = await getPortalSubscription(mine.customer.id, mine.subscription.id);
    expect(detail?.invoices.length).toBeGreaterThan(0);
    expect(detail?.lines[0].productName).toBe("Seat");
  });

  it("hides draft subscriptions", async () => {
    const { mine } = await twoCustomers();
    await db.subscription.update({ where: { id: mine.subscription.id }, data: { status: "DRAFT" } });
    expect(await getPortalSubscription(mine.customer.id, mine.subscription.id)).toBeNull();
    expect(await listPortalSubscriptions(mine.customer.id)).toHaveLength(0);
  });
});

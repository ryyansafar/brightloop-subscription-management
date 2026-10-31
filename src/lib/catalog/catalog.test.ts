import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { runBilling } from "@/lib/billing";
import { createSubscription } from "@/lib/subscriptions";
import { resetDb, seedSubscription, utc } from "@/test/factory";
import { discountService } from "./discounts";
import { planService } from "./plans";
import { addVariant, productService, removeVariant } from "./products";
import { taxService } from "./taxes";
import { templateService } from "./templates";

const listUrl = (query = "") => new URL(`http://localhost/api/x${query}`);
const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

beforeEach(resetDb);

describe("products and variants", () => {
  const input = {
    name: "Brightloop CRM",
    type: "SOFTWARE",
    salesPrice: 240_000,
    variants: [
      { attribute: "Brand", value: "Standard" },
      { attribute: "Brand", value: "Odoo", extraPrice: 56_000 },
    ],
  };

  it("creates a product with variants and lists it", async () => {
    const created = await productService.create(input);
    expect(created.variants).toHaveLength(2);
    expect(created.variants.find((v) => v.value === "Odoo")?.extraPrice).toBe(56_000);
    const list = await productService.list(listUrl("?q=crm"));
    expect(list.total).toBe(1);
  });

  it("rejects bad input with readable messages", async () => {
    await expect(productService.create({ ...input, salesPrice: -1 })).rejects.toThrow(/cannot be negative/);
    await expect(productService.create({ ...input, type: "GADGET" })).rejects.toThrow();
    await expect(productService.create({ ...input, name: "  " })).rejects.toThrow(/Name is required/);
    await expect(
      productService.create({ ...input, variants: [input.variants[1], { ...input.variants[1] }] }),
    ).rejects.toThrow(/Duplicate variant/);
  });

  it("price edits never rewrite existing subscription lines", async () => {
    const { product } = await seedSubscription({ unitPrice: 100_000 });
    await productService.update(product.id, { salesPrice: 999_000 });
    const line = await db.subscriptionLine.findFirstOrThrow({ where: { productId: product.id } });
    expect(line.unitPrice).toBe(100_000);
  });

  it("deactivating hides the product from new subscriptions", async () => {
    const { customer, plan, product } = await seedSubscription();
    await productService.remove(product.id);
    await expect(
      createSubscription({
        customerId: customer.id,
        planId: plan.id,
        startDate: "2026-02-01",
        lines: [{ productId: product.id, quantity: 1 }],
      }),
    ).rejects.toThrow(/inactive/);
  });

  it("blocks deleting a variant that subscriptions use", async () => {
    const { product } = await seedSubscription();
    const used = await addVariant(product.id, { attribute: "Brand", value: "Odoo", extraPrice: 56_000 });
    const spare = await addVariant(product.id, { attribute: "Brand", value: "Spare" });
    await db.subscriptionLine.updateMany({ where: { productId: product.id }, data: { variantOptionId: used.id } });
    await expect(removeVariant(product.id, used.id)).rejects.toThrow(/cannot be deleted/);
    await expect(removeVariant(product.id, spare.id)).resolves.toMatchObject({ deleted: true });
  });
});

describe("plans", () => {
  const input = { name: "Monthly", price: 240_000, periodUnit: "MONTH" };

  it("validates dates and minimum quantity", async () => {
    await expect(
      planService.create({ ...input, availableFrom: "2026-12-01", availableTo: "2026-11-01" }),
    ).rejects.toThrow(/Available-to date/);
    await expect(planService.create({ ...input, minQuantity: 0 })).rejects.toThrow(/at least 1/);
    await expect(planService.create({ ...input, periodUnit: "FORTNIGHT" })).rejects.toThrow();
  });

  it("re-checks cross-field rules on partial updates", async () => {
    const plan = await planService.create({ ...input, availableFrom: "2026-12-01", availableTo: "2026-12-31" });
    await expect(planService.update(plan.id, { availableTo: "2026-11-01" })).rejects.toThrow(/Available-to date/);
  });

  it("will not change the billing period while subscriptions bill on it", async () => {
    const { plan } = await seedSubscription();
    await expect(planService.update(plan.id, { periodUnit: "YEAR" })).rejects.toThrow(/billing on this plan/);
    await expect(planService.update(plan.id, { autoClose: true, name: "Renamed" })).resolves.toMatchObject({
      autoClose: true,
    });
    const idle = await planService.create(input);
    await expect(planService.update(idle.id, { periodUnit: "YEAR" })).resolves.toMatchObject({ periodUnit: "YEAR" });
  });
});

describe("taxes", () => {
  it("accepts 18% and rejects out-of-range rates", async () => {
    await expect(taxService.create({ name: "GST 18%", rateBps: 1800 })).resolves.toMatchObject({ rateBps: 1800 });
    await expect(taxService.create({ name: "Bad", rateBps: 10_001 })).rejects.toThrow(/exceed 100%/);
    await expect(taxService.create({ name: "Bad", rateBps: -5 })).rejects.toThrow(/negative/);
    await expect(taxService.create({ name: "Bad", rateBps: 18.5 })).rejects.toThrow(/whole basis points/);
  });
});

describe("discounts", () => {
  const base = {
    name: "Promo",
    kind: "PERCENT",
    value: 1000,
    startsAt: "2026-01-01",
    endsAt: "2027-01-01",
    scope: "SUBSCRIPTION",
  };

  it("enforces the rules from the brief", async () => {
    await expect(discountService.create({ ...base, value: 10_001 })).rejects.toThrow(/cannot exceed 100%/);
    await expect(discountService.create({ ...base, value: 0 })).rejects.toThrow(/greater than zero/);
    await expect(discountService.create({ ...base, endsAt: "2025-12-31" })).rejects.toThrow(/End date must be after/);
    await expect(discountService.create({ ...base, usageLimit: 0 })).rejects.toThrow(/at least 1/);
    await expect(discountService.create({ ...base, scope: "PRODUCT" })).rejects.toThrow(/Choose a product/);
    await expect(discountService.create({ ...base, productId: 1 })).rejects.toThrow(/has no product/);
    await expect(discountService.create({ ...base, scope: "PRODUCT", productId: 9999 })).rejects.toThrow(/Product not found/);
  });

  it("will not lower the usage limit below the uses already counted", async () => {
    const d = await discountService.create({ ...base, usageLimit: 10 });
    await db.discount.update({ where: { id: d.id }, data: { usedCount: 4 } });
    await expect(discountService.update(d.id, { usageLimit: 3 })).rejects.toThrow(/4 uses already counted/);
    await expect(discountService.update(d.id, { usageLimit: 4 })).resolves.toMatchObject({ usageLimit: 4 });
  });

  it("does not let a client write usedCount", async () => {
    const d = await discountService.create(base);
    await discountService.update(d.id, { name: "Renamed", usedCount: 99 });
    expect((await db.discount.findUniqueOrThrow({ where: { id: d.id } })).usedCount).toBe(0);
  });

  it("filters by state and retires instead of deleting", async () => {
    const running = await discountService.create({ ...base, startsAt: "2026-01-01", endsAt: soon(30) });
    await discountService.create({ ...base, startsAt: "2025-01-01", endsAt: "2025-02-01" });
    await discountService.create({ ...base, startsAt: soon(10), endsAt: soon(40) });
    expect((await discountService.list(listUrl("?state=running"))).total).toBe(1);
    expect((await discountService.list(listUrl("?state=expired"))).total).toBe(1);
    expect((await discountService.list(listUrl("?state=upcoming"))).total).toBe(1);
    await expect(discountService.remove(running.id)).resolves.toMatchObject({ active: false });
    expect(await db.discount.count()).toBe(3);
  });

  it("is applied by the billing engine once created through the catalog", async () => {
    const { product } = await seedSubscription({ taxBps: 0 });
    await discountService.create({
      name: "Volume",
      kind: "PERCENT",
      value: 1000,
      minQuantity: 2,
      startsAt: "2026-01-01",
      endsAt: "2030-01-01",
      scope: "PRODUCT",
      productId: product.id,
    });
    await runBilling(utc("2026-01-15"));
    const invoice = await db.invoice.findFirstOrThrow();
    expect(invoice.discountTotal).toBe(20_000); // 10% of 2 x 100,000
  });
});

describe("quotation templates", () => {
  async function fixtures() {
    const { customer, plan, product } = await seedSubscription();
    const other = await db.product.create({ data: { name: "Add-on", type: "ADDON", salesPrice: 30_000 } });
    return { customer, plan, product, other };
  }

  it("validates references and builds subscriptions", async () => {
    const { customer, plan, product } = await fixtures();
    await expect(
      templateService.create({ name: "T", planId: plan.id, lines: [] }),
    ).rejects.toThrow(/at least one product line/);
    await expect(
      templateService.create({ name: "T", planId: plan.id, lines: [{ productId: 9999, quantity: 1 }] }),
    ).rejects.toThrow(/not found/);
    await expect(
      templateService.create({ name: "T", planId: 9999, lines: [{ productId: product.id, quantity: 1 }] }),
    ).rejects.toThrow(/Plan not found/);

    const template = await templateService.create({
      name: "Starter",
      planId: plan.id,
      validityDays: 14,
      lines: [{ productId: product.id, quantity: 3 }],
    });
    const sub = await createSubscription({
      customerId: customer.id,
      planId: plan.id,
      templateId: template.id,
      startDate: "2026-02-01",
    });
    const lines = await db.subscriptionLine.findMany({ where: { subscriptionId: sub.id } });
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
  });

  it("replaces lines together with the header update", async () => {
    const { plan, product, other } = await fixtures();
    const template = await templateService.create({
      name: "Starter",
      planId: plan.id,
      lines: [{ productId: product.id, quantity: 1 }],
    });
    const updated = await templateService.update(template.id, {
      name: "Starter v2",
      lines: [{ productId: other.id, quantity: 5 }],
    });
    expect(updated.name).toBe("Starter v2");
    expect(updated.lines).toHaveLength(1);
    expect(updated.lines[0].productId).toBe(other.id);

    await expect(
      templateService.update(template.id, { lines: [{ productId: 9999, quantity: 1 }] }),
    ).rejects.toThrow(/not found/);
    expect((await templateService.get(template.id)).lines[0].productId).toBe(other.id);
  });
});

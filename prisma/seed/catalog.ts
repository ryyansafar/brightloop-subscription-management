import type { PrismaClient } from "@prisma/client";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export interface Catalog {
  products: { id: number; name: string; type: string; salesPrice: number }[];
  variants: { id: number; productId: number; extraPrice: number }[];
  plans: { id: number; name: string }[];
}

const PRODUCTS = [
  { name: "Brightloop CRM", type: "SOFTWARE", price: 240_000, cost: 90_000 },
  { name: "Brightloop Analytics", type: "SOFTWARE", price: 320_000, cost: 120_000 },
  { name: "Brightloop Helpdesk", type: "SOFTWARE", price: 180_000, cost: 70_000 },
  { name: "Priority Support", type: "ADDON", price: 60_000, cost: 20_000 },
  { name: "Extra Storage 100 GB", type: "ADDON", price: 30_000, cost: 8_000 },
  { name: "SSO and Audit Logs", type: "ADDON", price: 120_000, cost: 30_000 },
  { name: "API Access", type: "ADDON", price: 75_000, cost: 15_000 },
  { name: "Onboarding Package", type: "SERVICE", price: 500_000, cost: 250_000 },
];

const VARIANTS: Record<string, { attribute: string; value: string; extra: number }[]> = {
  "Brightloop CRM": [
    { attribute: "Brand", value: "Standard", extra: 0 },
    { attribute: "Brand", value: "Odoo", extra: 56_000 }, // choosing the Odoo brand adds 560
    { attribute: "Brand", value: "Enterprise", extra: 150_000 },
  ],
  "Brightloop Analytics": [
    { attribute: "Edition", value: "Basic", extra: 0 },
    { attribute: "Edition", value: "Pro", extra: 90_000 },
  ],
};

export async function seedCatalog(db: PrismaClient): Promise<Catalog> {
  await db.taxRate.createMany({
    data: [
      { name: "GST 18%", rateBps: 1800 },
      { name: "GST 5%", rateBps: 500 },
      { name: "Exempt", rateBps: 0 },
    ],
  });

  for (const p of PRODUCTS) {
    await db.product.create({
      data: {
        name: p.name,
        type: p.type,
        salesPrice: p.price,
        costPrice: p.cost,
        notes: `${p.type.toLowerCase()} offering`,
        variants: { create: (VARIANTS[p.name] ?? []).map((v) => ({
          attribute: v.attribute,
          value: v.value,
          extraPrice: v.extra,
        })) },
      },
    });
  }

  const plan = (data: Parameters<PrismaClient["plan"]["create"]>[0]["data"]) =>
    db.plan.create({ data });
  await plan({ name: "Daily Pass", price: 15_000, periodUnit: "DAY", closable: true, pausable: false });
  await plan({ name: "Weekly Sprint", price: 90_000, periodUnit: "WEEK" });
  await plan({ name: "Monthly Starter", price: 240_000, periodUnit: "MONTH" });
  await plan({ name: "Quarterly Growth", price: 650_000, periodUnit: "MONTH", periodCount: 3, minQuantity: 5 });
  await plan({
    name: "Yearly Business",
    price: 2_400_000,
    periodUnit: "YEAR",
    minQuantity: 10,
  });
  await plan({ name: "12-Month Contract", price: 240_000, periodUnit: "MONTH", autoClose: true, renewable: true });
  await plan({
    name: "Black Friday Annual",
    price: 1_900_000,
    periodUnit: "YEAR",
    minQuantity: 5,
    availableFrom: day("2026-11-20"),
    availableTo: day("2026-11-30"),
  });
  await plan({ name: "Legacy Plan", price: 100_000, periodUnit: "MONTH", active: false });

  const products = await db.product.findMany({ orderBy: { id: "asc" } });
  const variants = await db.variantOption.findMany();
  const plans = await db.plan.findMany({ orderBy: { id: "asc" } });
  const byName = new Map(products.map((p) => [p.name, p.id]));
  const crm = byName.get("Brightloop CRM")!;

  await db.discount.createMany({
    data: [
      { name: "Volume 10% (10+ seats CRM)", kind: "PERCENT", value: 1000, minQuantity: 10,
        startsAt: day("2025-01-01"), endsAt: day("2027-12-31"), scope: "PRODUCT", productId: crm },
      { name: "Loyalty Rs 500 off", kind: "FIXED", value: 50_000, minAmount: 1_000_000,
        startsAt: day("2025-06-01"), endsAt: day("2027-12-31"), scope: "SUBSCRIPTION" },
      { name: "Diwali 15%", kind: "PERCENT", value: 1500, startsAt: day("2026-08-15"),
        endsAt: day("2026-11-15"), usageLimit: 150, scope: "SUBSCRIPTION" },
      { name: "Spring Promo (expired)", kind: "PERCENT", value: 2000, startsAt: day("2026-03-01"),
        endsAt: day("2026-04-30"), usageLimit: 40, scope: "PRODUCT", productId: byName.get("Brightloop Analytics")! },
    ],
  });

  const planId = (name: string) => plans.find((p) => p.name === name)!.id;
  const templates: [string, string, [string, number][]][] = [
    ["Starter Team (5 seats)", "Monthly Starter", [["Brightloop CRM", 5], ["Priority Support", 1]]],
    ["Growth Bundle", "Quarterly Growth", [["Brightloop CRM", 10], ["Brightloop Analytics", 5], ["Extra Storage 100 GB", 2]]],
    ["Enterprise Annual", "Yearly Business", [["Brightloop CRM", 25], ["SSO and Audit Logs", 1], ["API Access", 1], ["Priority Support", 1]]],
    ["Contract Standard", "12-Month Contract", [["Brightloop CRM", 8], ["Brightloop Helpdesk", 4]]],
  ];
  for (const [name, planName, lines] of templates) {
    await db.quoteTemplate.create({
      data: {
        name,
        planId: planId(planName),
        validityDays: 30,
        lines: { create: lines.map(([product, quantity]) => ({ productId: byName.get(product)!, quantity })) },
      },
    });
  }

  return {
    products: products.map((p) => ({ id: p.id, name: p.name, type: p.type, salesPrice: p.salesPrice })),
    variants: variants.map((v) => ({ id: v.id, productId: v.productId, extraPrice: v.extraPrice })),
    plans: plans.map((p) => ({ id: p.id, name: p.name })),
  };
}

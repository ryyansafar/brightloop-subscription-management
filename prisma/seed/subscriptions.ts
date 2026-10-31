import type { Prisma, PrismaClient } from "@prisma/client";
import { fakerEN_IN as faker } from "@faker-js/faker";
import { addDays, addMonthsClamped } from "../../src/lib/dates";
import type { Catalog } from "./catalog";

interface PlanProfile {
  name: string;
  weight: number;
  qty: [number, number];
  /** how far back (days) the subscription may have started */
  within: number;
  /** fixed term in months, closes on its own */
  termMonths?: number;
}

const PROFILES: PlanProfile[] = [
  { name: "Daily Pass", weight: 3, qty: [1, 3], within: 20 },
  { name: "Weekly Sprint", weight: 8, qty: [1, 6], within: 120 },
  { name: "Monthly Starter", weight: 45, qty: [1, 12], within: 420 },
  { name: "Quarterly Growth", weight: 12, qty: [5, 20], within: 420 },
  { name: "Yearly Business", weight: 15, qty: [10, 40], within: 700 },
  { name: "12-Month Contract", weight: 17, qty: [1, 10], within: 420, termMonths: 12 },
];

const STATUS_WEIGHTS: [string, number][] = [
  ["ACTIVE", 73],
  ["PAUSED", 5],
  ["CLOSED", 10],
  ["DRAFT", 4],
  ["QUOTATION", 4],
  ["CONFIRMED", 4],
];

/** First six subscriptions belong to the demo customer so the portal demo is rich and stable. */
const DEMO_FORCED: { plan: string; status: string; ago: number }[] = [
  { plan: "Monthly Starter", status: "ACTIVE", ago: 170 },
  { plan: "Quarterly Growth", status: "ACTIVE", ago: 200 },
  { plan: "Yearly Business", status: "ACTIVE", ago: 400 },
  { plan: "Monthly Starter", status: "PAUSED", ago: 120 },
  { plan: "Monthly Starter", status: "CLOSED", ago: 150 },
  { plan: "Monthly Starter", status: "QUOTATION", ago: -5 },
];

export interface GeneratedSubscriptions {
  total: number;
  pausedIds: number[];
  churnIds: number[];
}

export async function generateSubscriptions(
  db: PrismaClient,
  catalog: Catalog,
  total: number,
  customerCount: number,
  now: Date,
): Promise<GeneratedSubscriptions> {
  const planByName = new Map(catalog.plans.map((p) => [p.name, p.id]));
  const software = catalog.products.filter((p) => p.type === "SOFTWARE");
  const addons = catalog.products.filter((p) => p.type === "ADDON");
  const service = catalog.products.find((p) => p.type === "SERVICE");

  const subs: Prisma.SubscriptionCreateManyInput[] = [];
  const lines: Prisma.SubscriptionLineCreateManyInput[] = [];
  const pausedIds: number[] = [];
  const churnIds: number[] = [];

  for (let i = 0; i < total; i++) {
    const id = i + 1;
    const forced = DEMO_FORCED[i];
    const profile = forced
      ? PROFILES.find((p) => p.name === forced.plan)!
      : faker.helpers.weightedArrayElement(PROFILES.map((p) => ({ weight: p.weight, value: p })));
    const wanted = forced
      ? forced.status
      : faker.helpers.weightedArrayElement(STATUS_WEIGHTS.map(([value, weight]) => ({ weight, value })));
    const customerId = forced ? 1 : faker.number.int({ min: 2, max: customerCount });

    const billed = ["ACTIVE", "PAUSED", "CLOSED"].includes(wanted);
    const daysAgo = forced ? forced.ago : faker.number.int({ min: billed ? 2 : -30, max: billed ? profile.within : -1 });
    const start = addDays(now, -daysAgo);

    const status = billed ? "ACTIVE" : wanted;
    let endDate: Date | null = profile.termMonths ? addMonthsClamped(start, profile.termMonths) : null;
    if (wanted === "CLOSED" && !profile.termMonths && daysAgo >= 55) {
      endDate = addDays(start, faker.number.int({ min: 45, max: daysAgo - 10 }));
      churnIds.push(id);
    }
    if (wanted === "PAUSED" && daysAgo >= 30) pausedIds.push(id);

    subs.push({
      id,
      number: `SUB-${String(id).padStart(5, "0")}`,
      customerId,
      planId: planByName.get(profile.name)!,
      status,
      startDate: start,
      endDate,
      nextInvoiceDate: billed ? start : null,
      anchorDay: start.getUTCDate(),
      paymentTermDays: faker.helpers.arrayElement([7, 15, 15, 30]),
    });

    const main = faker.helpers.arrayElement(software);
    const picks = [{ product: main, qty: faker.number.int({ min: profile.qty[0], max: profile.qty[1] }) }];
    for (const addon of addons) {
      if (faker.number.int({ min: 1, max: 100 }) <= 22) picks.push({ product: addon, qty: 1 });
    }
    if (service && faker.number.int({ min: 1, max: 100 }) <= 8) picks.push({ product: service, qty: 1 });

    for (const { product, qty } of picks.slice(0, 4)) {
      const options = catalog.variants.filter((v) => v.productId === product.id);
      const variant = options.length ? faker.helpers.arrayElement(options) : null;
      lines.push({
        subscriptionId: id,
        productId: product.id,
        variantOptionId: variant?.id ?? null,
        quantity: qty,
        unitPrice: product.salesPrice + (variant?.extraPrice ?? 0),
        taxBps: faker.helpers.weightedArrayElement([
          { weight: 80, value: 1800 },
          { weight: 15, value: 500 },
          { weight: 5, value: 0 },
        ]),
      });
    }
  }

  for (let i = 0; i < subs.length; i += 500) {
    await db.subscription.createMany({ data: subs.slice(i, i + 500) });
  }
  for (let i = 0; i < lines.length; i += 500) {
    await db.subscriptionLine.createMany({ data: lines.slice(i, i + 500) });
  }
  return { total, pausedIds, churnIds };
}

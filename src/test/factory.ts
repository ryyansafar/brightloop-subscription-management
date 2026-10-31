import { db } from "@/lib/db";

export const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Wipe every table, children first. */
export async function resetDb(): Promise<void> {
  await db.mailOutbox.deleteMany();
  await db.authRateLimit.deleteMany();
  await db.emailVerification.deleteMany();
  await db.payment.deleteMany();
  await db.invoiceLine.deleteMany();
  await db.invoice.deleteMany();
  await db.subscriptionLine.deleteMany();
  await db.subscription.deleteMany();
  await db.quoteTemplateLine.deleteMany();
  await db.quoteTemplate.deleteMany();
  await db.discount.deleteMany();
  await db.variantOption.deleteMany();
  await db.product.deleteMany();
  await db.plan.deleteMany();
  await db.taxRate.deleteMany();
  await db.passwordReset.deleteMany();
  await db.customer.deleteMany();
  await db.user.deleteMany();
}

interface SeedOptions {
  periodUnit?: string;
  periodCount?: number;
  autoClose?: boolean;
  start?: string;
  end?: string | null;
  status?: string;
  quantity?: number;
  unitPrice?: number;
  taxBps?: number;
}

/** One customer, one plan, one product and an ACTIVE subscription with one line. */
export async function seedSubscription(options: SeedOptions = {}) {
  const customer = await db.customer.create({
    data: { name: "Test Customer", email: `c${Date.now()}${Math.random()}@test.dev` },
  });
  const plan = await db.plan.create({
    data: {
      name: "Monthly",
      price: 0,
      periodUnit: options.periodUnit ?? "MONTH",
      periodCount: options.periodCount ?? 1,
      autoClose: options.autoClose ?? false,
    },
  });
  const product = await db.product.create({
    data: { name: "Seat", type: "SERVICE", salesPrice: options.unitPrice ?? 100_000 },
  });
  const start = utc(options.start ?? "2026-01-15");
  const count = await db.subscription.count();
  const subscription = await db.subscription.create({
    data: {
      number: `SUB-${String(count + 1).padStart(5, "0")}`,
      customerId: customer.id,
      planId: plan.id,
      status: options.status ?? "ACTIVE",
      startDate: start,
      endDate: options.end === undefined ? null : options.end ? utc(options.end) : null,
      nextInvoiceDate: start,
      anchorDay: start.getUTCDate(),
      paymentTermDays: 15,
      lines: {
        create: [
          {
            productId: product.id,
            quantity: options.quantity ?? 2,
            unitPrice: options.unitPrice ?? 100_000,
            taxBps: options.taxBps ?? 1800,
          },
        ],
      },
    },
  });
  return { customer, plan, product, subscription };
}

export async function seedDiscount(
  productId: number,
  over: Partial<{
    kind: string;
    value: number;
    startsAt: Date;
    endsAt: Date;
    usageLimit: number | null;
    scope: string;
  }> = {},
) {
  return db.discount.create({
    data: {
      name: "Promo",
      kind: over.kind ?? "PERCENT",
      value: over.value ?? 1000,
      startsAt: over.startsAt ?? utc("2026-01-01"),
      endsAt: over.endsAt ?? utc("2030-01-01"),
      usageLimit: over.usageLimit === undefined ? null : over.usageLimit,
      scope: over.scope ?? "PRODUCT",
      productId: over.scope === "SUBSCRIPTION" ? null : productId,
    },
  });
}

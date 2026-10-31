import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { addPeriod } from "./dates";
import { DomainError } from "./errors";
import { bestEffort, sendSubscriptionActivatedEmail } from "./notification-mail";
import { canMoveSubscription, type PeriodUnit, type SubscriptionStatus } from "./state";

const lineSchema = z.object({
  productId: z.number().int().positive(),
  variantOptionId: z.number().int().positive().nullish(),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  taxRateId: z.number().int().positive().nullish(),
});

export const createSubscriptionSchema = z
  .object({
    customerId: z.number().int().positive(),
    planId: z.number().int().positive(),
    templateId: z.number().int().positive().nullish(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().nullish(),
    paymentTermDays: z.number().int().min(0).max(365).default(15),
    lines: z.array(lineSchema).optional(),
  })
  .refine((v) => !v.endDate || v.endDate > v.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  });

export type CreateSubscriptionInput = z.input<typeof createSubscriptionSchema>;

type Client = PrismaClient | Prisma.TransactionClient;

/** Create a DRAFT subscription from explicit lines, or from a quotation template. */
export async function createSubscription(
  input: CreateSubscriptionInput,
  client: PrismaClient = db,
): Promise<{ id: number; number: string }> {
  const data = createSubscriptionSchema.parse(input);

  return client.$transaction(async (tx) => {
    const [customer, plan] = await Promise.all([
      tx.customer.findUnique({ where: { id: data.customerId } }),
      tx.plan.findUnique({ where: { id: data.planId } }),
    ]);
    if (!customer) throw new DomainError("Customer not found", 404);
    if (!plan || !plan.active) throw new DomainError("Plan not found or inactive", 404);
    if (plan.availableFrom && data.startDate < plan.availableFrom) {
      throw new DomainError("Plan is not available yet on that start date");
    }
    if (plan.availableTo && data.startDate > plan.availableTo) {
      throw new DomainError("Plan is no longer available on that start date");
    }

    let rawLines = data.lines ?? [];
    if (rawLines.length === 0 && data.templateId) {
      const template = await tx.quoteTemplate.findUnique({
        where: { id: data.templateId },
        include: { lines: true },
      });
      if (!template) throw new DomainError("Quotation template not found", 404);
      rawLines = template.lines.map((l) => ({
        productId: l.productId,
        variantOptionId: l.variantOptionId,
        quantity: l.quantity,
      }));
    }
    if (rawLines.length === 0) throw new DomainError("A subscription needs at least one line");

    const totalQuantity = rawLines.reduce((sum, l) => sum + l.quantity, 0);
    if (totalQuantity < plan.minQuantity) {
      throw new DomainError(`This plan requires a minimum quantity of ${plan.minQuantity}`);
    }

    const lines = [];
    for (const raw of rawLines) {
      const product = await tx.product.findUnique({ where: { id: raw.productId } });
      if (!product || !product.active) {
        throw new DomainError(`Product ${raw.productId} not found or inactive`, 404);
      }
      let extra = 0;
      if (raw.variantOptionId) {
        const variant = await tx.variantOption.findUnique({ where: { id: raw.variantOptionId } });
        if (!variant || variant.productId !== product.id) {
          throw new DomainError("Variant does not belong to that product");
        }
        extra = variant.extraPrice;
      }
      let taxBps = 0;
      if (raw.taxRateId) {
        const tax = await tx.taxRate.findUnique({ where: { id: raw.taxRateId } });
        if (!tax || !tax.active) throw new DomainError("Tax rate not found or inactive", 404);
        taxBps = tax.rateBps;
      }
      lines.push({
        productId: product.id,
        variantOptionId: raw.variantOptionId ?? null,
        quantity: raw.quantity,
        unitPrice: product.salesPrice + extra,
        taxBps,
      });
    }

    const last = await tx.subscription.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
    const number = `SUB-${String((last?.id ?? 0) + 1).padStart(5, "0")}`;
    return tx.subscription.create({
      data: {
        number,
        customerId: customer.id,
        planId: plan.id,
        templateId: data.templateId ?? null,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        paymentTermDays: data.paymentTermDays,
        lines: { create: lines },
      },
      select: { id: true, number: true },
    });
  });
}

interface TransitionOptions {
  closeReason?: string;
  today?: Date;
}

/** Move a subscription along Draft → Quotation → Confirmed → Active → Closed. */
export async function transitionSubscription(
  id: number,
  to: SubscriptionStatus,
  { closeReason, today = new Date() }: TransitionOptions = {},
  client: Client = db,
): Promise<void> {
  const sub = await client.subscription.findUnique({
    where: { id },
    include: { plan: true, customer: true, lines: true },
  });
  if (!sub) throw new DomainError("Subscription not found", 404);

  const from = sub.status as SubscriptionStatus;
  if (!canMoveSubscription(from, to)) {
    throw new DomainError(`Cannot move a subscription from ${from} to ${to}`, 409);
  }

  const data: Prisma.SubscriptionUpdateInput = { status: to };
  if (to === "ACTIVE" && from === "CONFIRMED") {
    data.nextInvoiceDate = sub.startDate;
    data.anchorDay = sub.startDate.getUTCDate();
  }
  if (to === "PAUSED") {
    if (!sub.plan.pausable) throw new DomainError("This plan cannot be paused", 409);
    data.pausedAt = today;
  }
  if (to === "ACTIVE" && from === "PAUSED") {
    data.pausedAt = null;
    // skip the paused time instead of billing it in a burst on resume
    if (sub.nextInvoiceDate && sub.nextInvoiceDate < today) data.nextInvoiceDate = today;
  }
  if (to === "CLOSED") {
    if (!sub.plan.closable) throw new DomainError("This plan cannot be closed early", 409);
    if (!closeReason?.trim()) throw new DomainError("A close reason is required");
    data.closeReason = closeReason.trim();
    data.nextInvoiceDate = null;
  }
  await client.subscription.update({ where: { id }, data });

  // Only a first activation is announced, not a resume from pause. Runs after the update has committed.
  if (to === "ACTIVE" && from === "CONFIRMED") {
    await bestEffort("Subscription activated", () =>
      sendSubscriptionActivatedEmail({
        subscription: { id: sub.id, number: sub.number },
        planName: sub.plan.name,
        customer: sub.customer,
        recurringAmount: sub.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
        nextInvoiceDate: sub.startDate,
        activatedAt: today,
      }),
    );
  }
}

/** Extend an active subscription by one plan period. */
export async function renewSubscription(id: number, client: Client = db): Promise<Date> {
  const sub = await client.subscription.findUnique({ where: { id }, include: { plan: true } });
  if (!sub) throw new DomainError("Subscription not found", 404);
  if (!sub.plan.renewable) throw new DomainError("This plan cannot be renewed", 409);
  if (sub.status !== "ACTIVE") throw new DomainError("Only active subscriptions can be renewed", 409);
  if (!sub.endDate) throw new DomainError("This subscription has no end date to renew", 409);

  const endDate = addPeriod(
    sub.endDate,
    sub.plan.periodUnit as PeriodUnit,
    sub.plan.periodCount,
    sub.anchorDay ?? undefined,
  );
  await client.subscription.update({
    where: { id },
    // billing stops at the old end date; resume from it
    data: { endDate, nextInvoiceDate: sub.nextInvoiceDate ?? sub.endDate },
  });
  return endDate;
}

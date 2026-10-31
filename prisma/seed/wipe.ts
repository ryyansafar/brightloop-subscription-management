import type { PrismaClient } from "@prisma/client";

/** Delete every row, children first, so the seed can be re-run safely. */
export async function wipeAll(db: PrismaClient): Promise<void> {
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

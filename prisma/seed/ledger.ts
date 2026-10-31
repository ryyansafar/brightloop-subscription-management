import type { PrismaClient } from "@prisma/client";
import { fakerEN_IN as faker } from "@faker-js/faker";
import { addDays } from "../../src/lib/dates";

const DAY = 86_400_000;
const METHODS = [
  { weight: 40, value: "UPI" },
  { weight: 30, value: "BANK_TRANSFER" },
  { weight: 20, value: "CARD" },
  { weight: 7, value: "CASH" },
  { weight: 3, value: "OTHER" },
];

/**
 * Give the generated invoices a realistic life: older ones mostly paid, some
 * overdue, the newest still draft. Payments always add up to the invoice.
 */
export async function settleInvoices(db: PrismaClient, now: Date): Promise<void> {
  const invoices = await db.invoice.findMany({
    select: { id: true, total: true, periodStart: true, dueDate: true },
    orderBy: { id: "asc" },
  });

  const confirmed: number[] = [];
  const draft: number[] = [];
  const payments: {
    invoiceId: number;
    method: string;
    amount: number;
    paidOn: Date;
    note: string | null;
  }[] = [];
  const paid: number[] = [];

  for (const inv of invoices) {
    const age = (now.getTime() - inv.periodStart.getTime()) / DAY;
    const roll = faker.number.int({ min: 1, max: 100 });
    const paidChance = age > 60 ? 88 : age > 20 ? 60 : 0;

    if (inv.total === 0 || roll <= paidChance) {
      paid.push(inv.id);
      if (inv.total > 0) {
        const delay = faker.number.int({ min: 0, max: 20 });
        const paidOn = new Date(Math.min(addDays(inv.periodStart, delay).getTime(), now.getTime()));
        payments.push({
          invoiceId: inv.id,
          method: faker.helpers.weightedArrayElement(METHODS),
          amount: inv.total,
          paidOn,
          note: null,
        });
      }
    } else if (age <= 20 && roll > 70) {
      draft.push(inv.id);
    } else {
      confirmed.push(inv.id);
      // a few part-paid invoices
      if (roll % 17 === 0 && inv.total > 1000) {
        const part = Math.floor(inv.total * 0.4);
        payments.push({
          invoiceId: inv.id,
          method: faker.helpers.weightedArrayElement(METHODS),
          amount: part,
          paidOn: new Date(Math.min(addDays(inv.periodStart, 5).getTime(), now.getTime())),
          note: "Part payment",
        });
      }
    }
  }

  const setStatus = async (ids: number[], status: string) => {
    for (let i = 0; i < ids.length; i += 500) {
      await db.invoice.updateMany({ where: { id: { in: ids.slice(i, i + 500) } }, data: { status } });
    }
  };
  await setStatus(paid, "PAID");
  await setStatus(confirmed, "CONFIRMED");
  await setStatus(draft, "DRAFT");
  for (let i = 0; i < payments.length; i += 500) {
    await db.payment.createMany({ data: payments.slice(i, i + 500) });
  }
}

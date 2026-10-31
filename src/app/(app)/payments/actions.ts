"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { outstanding } from "@/lib/invoices";

export interface PayableInvoice {
  id: number;
  number: string;
  customer: string;
  balance: number; // paise
  dueDate: string; // ISO
}

/** Confirmed invoices that still have a balance, matched by number or customer name. Staff and admins only. */
export async function searchPayableInvoices(query: string): Promise<PayableInvoice[]> {
  const cookie = (await cookies()).toString();
  const user = await getSessionUser(new Request("http://app.local", { headers: { cookie } }));
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) return [];

  const q = String(query ?? "").trim().slice(0, 80);
  const rows = await db.invoice.findMany({
    where: {
      status: "CONFIRMED",
      ...(q ? { OR: [{ number: { contains: q } }, { customer: { name: { contains: q } } }] } : {}),
    },
    select: {
      id: true,
      number: true,
      total: true,
      dueDate: true,
      customer: { select: { name: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 30,
  });
  return rows
    .map((r) => ({
      id: r.id,
      number: r.number,
      customer: r.customer.name,
      balance: outstanding({ total: r.total, payments: r.payments }),
      dueDate: r.dueDate.toISOString(),
    }))
    .filter((r) => r.balance > 0)
    .slice(0, 8);
}

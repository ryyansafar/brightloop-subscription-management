// Create a subscription: loads the catalog once, the form runs in the browser.
import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader, toDateInput } from "@/components";
import { db } from "@/lib/db";
import { NewSubscriptionForm } from "./NewSubscriptionForm";

export const metadata: Metadata = { title: "New subscription" };

export default async function NewSubscriptionPage() {
  await connection();
  const [plans, products, taxes, templates] = await Promise.all([
    db.plan.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    db.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        salesPrice: true,
        variants: { orderBy: { id: "asc" }, select: { id: true, attribute: true, value: true, extraPrice: true } },
      },
    }),
    db.taxRate.findMany({ where: { active: true }, orderBy: { id: "asc" }, select: { id: true, name: true, rateBps: true } }),
    db.quoteTemplate.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        planId: true,
        lines: { orderBy: { id: "asc" }, select: { productId: true, variantOptionId: true, quantity: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader title="New subscription" breadcrumbs={[{ label: "Subscriptions", href: "/subscriptions" }]} />
      <NewSubscriptionForm
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          periodUnit: p.periodUnit,
          periodCount: p.periodCount,
          minQuantity: p.minQuantity,
          availableFrom: p.availableFrom?.toISOString() ?? null,
          availableTo: p.availableTo?.toISOString() ?? null,
        }))}
        products={products}
        taxes={taxes}
        templates={templates}
        defaultStart={toDateInput(new Date())}
      />
    </>
  );
}

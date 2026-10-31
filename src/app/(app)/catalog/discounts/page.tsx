import type { Metadata } from "next";
import { connection } from "next/server";
import { pageParam, param, type Params } from "@/components";
import { db } from "@/lib/db";
import { getCatalogUserRole } from "../helpers";
import { DiscountsView } from "./DiscountsView";

export const metadata: Metadata = { title: "Discounts - Catalog" };

const PAGE_SIZE = 20;

export default async function DiscountsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const params = await searchParams;
  const page = pageParam(params);
  const now = new Date();
  const state = param(params, "state");
  const activeParam = param(params, "active");
  const active = activeParam === "1" ? true : activeParam === "0" ? false : undefined;

  const where = {
    ...(active !== undefined ? { active } : {}),
    ...(state === "running" ? { startsAt: { lte: now }, endsAt: { gte: now } } : {}),
    ...(state === "expired" ? { endsAt: { lt: now } } : {}),
    ...(state === "upcoming" ? { startsAt: { gt: now } } : {}),
  };

  const [discounts, total, products] = await Promise.all([
    db.discount.findMany({
      where,
      include: { product: { select: { id: true, name: true } } },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.discount.count({ where }),
    db.product.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const role = await getCatalogUserRole();
  const canWrite = role === "ADMIN";

  return (
    <DiscountsView
      discounts={discounts}
      total={total}
      products={products}
      searchParams={params}
      canWrite={canWrite}
    />
  );
}

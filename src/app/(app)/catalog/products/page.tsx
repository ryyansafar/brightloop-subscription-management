import type { Metadata } from "next";
import { connection } from "next/server";
import { pageParam, param, type Params } from "@/components";
import { db } from "@/lib/db";
import { getCatalogUserRole } from "../helpers";
import { ProductsView } from "./ProductsView";

export const metadata: Metadata = { title: "Products - Catalog" };

const PAGE_SIZE = 20;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const params = await searchParams;
  const page = pageParam(params);
  const q = param(params, "q")?.trim();
  const type = param(params, "type");
  const activeParam = param(params, "active");
  const active = activeParam === "1" ? true : activeParam === "0" ? false : undefined;

  const where = {
    ...(q ? { name: { contains: q } } : {}),
    ...(type ? { type } : {}),
    ...(active !== undefined ? { active } : {}),
  };

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      include: { variants: { orderBy: { id: "asc" } } },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.product.count({ where }),
  ]);

  const role = await getCatalogUserRole();
  const canWrite = role === "ADMIN";

  return <ProductsView products={products} total={total} searchParams={params} canWrite={canWrite} />;
}

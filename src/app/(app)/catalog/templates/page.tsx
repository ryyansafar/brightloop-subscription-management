import type { Metadata } from "next";
import { connection } from "next/server";
import { pageParam, param, type Params } from "@/components";
import { db } from "@/lib/db";
import { getCatalogUserRole } from "../helpers";
import { TemplatesView } from "./TemplatesView";

export const metadata: Metadata = { title: "Quotation Templates - Catalog" };

const PAGE_SIZE = 20;

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const params = await searchParams;
  const page = pageParam(params);
  const q = param(params, "q")?.trim();

  const where = q ? { name: { contains: q } } : {};

  const [templates, total, plans, products] = await Promise.all([
    db.quoteTemplate.findMany({
      where,
      include: {
        plan: { select: { id: true, name: true } },
        lines: { orderBy: { id: "asc" } },
      },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.quoteTemplate.count({ where }),
    db.plan.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.product.findMany({
      where: { active: true },
      select: { id: true, name: true, variants: { select: { id: true, attribute: true, value: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const role = await getCatalogUserRole();
  const canWrite = role === "ADMIN";

  return (
    <TemplatesView
      templates={templates}
      total={total}
      plans={plans}
      products={products}
      searchParams={params}
      canWrite={canWrite}
    />
  );
}

import type { Metadata } from "next";
import { connection } from "next/server";
import { pageParam, param, type Params } from "@/components";
import { db } from "@/lib/db";
import { getCatalogUserRole } from "../helpers";
import { TaxesView } from "./TaxesView";

export const metadata: Metadata = { title: "Tax Rates - Catalog" };

const PAGE_SIZE = 20;

export default async function TaxesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const params = await searchParams;
  const page = pageParam(params);
  const activeParam = param(params, "active");
  const active = activeParam === "1" ? true : activeParam === "0" ? false : undefined;

  const where = active !== undefined ? { active } : {};

  const [taxes, total] = await Promise.all([
    db.taxRate.findMany({ where, orderBy: { id: "asc" }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    db.taxRate.count({ where }),
  ]);

  const role = await getCatalogUserRole();
  const canWrite = role === "ADMIN";

  return <TaxesView taxes={taxes} total={total} searchParams={params} canWrite={canWrite} />;
}

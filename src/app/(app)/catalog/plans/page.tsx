import type { Metadata } from "next";
import { connection } from "next/server";
import { pageParam, param, type Params } from "@/components";
import { db } from "@/lib/db";
import { getCatalogUserRole } from "../helpers";
import { PlansView } from "./PlansView";

export const metadata: Metadata = { title: "Plans - Catalog" };

const PAGE_SIZE = 20;

export default async function PlansPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const params = await searchParams;
  const page = pageParam(params);
  const q = param(params, "q")?.trim();
  const unit = param(params, "periodUnit");
  const activeParam = param(params, "active");
  const active = activeParam === "1" ? true : activeParam === "0" ? false : undefined;

  const where = {
    ...(q ? { name: { contains: q } } : {}),
    ...(unit ? { periodUnit: unit } : {}),
    ...(active !== undefined ? { active } : {}),
  };

  const [plans, total] = await Promise.all([
    db.plan.findMany({ where, orderBy: { id: "asc" }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    db.plan.count({ where }),
  ]);

  const role = await getCatalogUserRole();
  const canWrite = role === "ADMIN";

  return <PlansView plans={plans} total={total} searchParams={params} canWrite={canWrite} />;
}

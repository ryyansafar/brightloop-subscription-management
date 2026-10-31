// Subscriptions list: stat cards, status chips, search, sorting and paging, all driven by the URL.
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Button, PageHeader, StatCard, hrefWith, pageParam, param, type Params } from "@/components";
import { formatINR } from "@/lib/money";
import { ListTable } from "./ListTable";
import { DUE_DAYS, listSubscriptions, parseSort, parseStatus, subscriptionStats } from "./queries";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const params = await searchParams;
  const today = new Date();
  const page = pageParam(params);
  const dueSoon = param(params, "due") === "7";
  const { sort, dir } = parseSort(param(params, "sort"), param(params, "dir"));
  const [{ rows, total }, stats] = await Promise.all([
    listSubscriptions({ status: parseStatus(param(params, "status")), q: param(params, "q"), dueSoon, sort, dir, page, today }),
    subscriptionStats(today),
  ]);

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description={`${total.toLocaleString("en-IN")} ${dueSoon ? "due to invoice soon" : "subscriptions"}`}
        actions={<Button variant="primary" href="/subscriptions/new" className="min-h-10">New subscription</Button>}
      />
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Active subscriptions"
            value={stats.active.toLocaleString("en-IN")}
            tone="success"
            hint="Show active"
            href="/subscriptions?status=active"
          />
          <StatCard
            label="Monthly recurring revenue"
            value={formatINR(stats.mrr)}
            hint="Normalised to a month, tax included"
            href="/subscriptions?status=active"
          />
          <StatCard
            label={`Next ${DUE_DAYS} days`}
            value={stats.dueSoon.toLocaleString("en-IN")}
            tone="primary"
            hint="Invoices due to generate"
            href="/subscriptions?due=7"
          />
        </div>

        {dueSoon && (
          <p className="text-sm text-muted">
            Showing active subscriptions that invoice within {DUE_DAYS} days.{" "}
            <Link href={hrefWith("/subscriptions", params, { due: undefined, page: undefined })} className="text-primary hover:underline">
              Clear
            </Link>
          </p>
        )}

        <ListTable rows={rows} params={params} sort={sort} dir={dir} page={page} total={total} />
      </div>
    </>
  );
}

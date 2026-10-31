import type { Metadata } from "next";
import { Suspense } from "react";
import { PagePending } from "@/lib/auth/ui/PagePending";
import { Button, PageHeader, StatCard, StatusBadge, formatDate, param, pageParam, type Params } from "@/components";
import { TableToolbar } from "@/components/table/TableToolbar";
import { Pagination } from "@/components/table/Pagination";
import { formatINR } from "@/lib/money";
import { LogoutButton } from "@/lib/auth/ui/LogoutButton";
import { SubscriptionActions } from "@/app/(app)/subscriptions/SubscriptionActions";
import { portalOverview, PAGE_SIZE } from "./queries";

export const metadata: Metadata = { title: "My subscriptions" };
async function PortalPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const data = await portalOverview({ status: param(params, "status"), q: param(params, "q"), page: pageParam(params) });
  return <><PageHeader title={`Welcome, ${data.user.name.split(" ")[0]}`} description="Your subscriptions, renewals and billing, all in one place." actions={<><LogoutButton /><Button href="/portal/invoices" variant="primary">View my invoices</Button></>} />
    <div className="space-y-6 p-4 md:p-6"><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Active subscriptions" value={String(data.active)} tone="success" /><StatCard label="Outstanding invoices" value={formatINR(data.outstanding)} tone={data.outstanding > 0 ? "warning" : "neutral"} href="/portal/invoices?status=CONFIRMED" /><StatCard label="Next invoice date" value={formatDate(data.nextInvoiceDate)} /></div>
      <section className="overflow-hidden rounded-xl border border-line bg-surface"><TableToolbar basePath="/portal" searchParams={params} filters={[{ param: "status", options: [{ label: "Active", value: "ACTIVE" }, { label: "Paused", value: "PAUSED" }, { label: "Closed", value: "CLOSED" }] }]} search={{ placeholder: "Search your subscriptions" }} /></section>
      {data.rows.length ? <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">{data.rows.map((subscription) => <article key={subscription.id} className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5"><div><p className="mb-2 text-xs font-medium text-muted">{subscription.number}</p><h2 className="text-lg font-semibold">{subscription.plan.name}</h2></div><StatusBadge status={subscription.status} /></div>
        <div className="space-y-5 p-5"><div><p className="text-2xl font-semibold tracking-tight tabular-nums">{formatINR(subscription.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0))}</p><p className="mt-1 text-xs text-muted">Every {subscription.plan.periodCount} {subscription.plan.periodUnit.toLowerCase()}{subscription.plan.periodCount > 1 ? "s" : ""}, before tax and discounts</p></div>
          <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs text-muted">Next invoice</dt><dd className="mt-1 font-medium">{formatDate(subscription.nextInvoiceDate)}</dd></div><div><dt className="text-xs text-muted">Contract ends</dt><dd className="mt-1 font-medium">{subscription.endDate ? formatDate(subscription.endDate) : "Ongoing"}</dd></div></dl>
          <div className="flex flex-wrap gap-2 border-t border-line pt-4"><Button href={`/portal/subscriptions/${subscription.id}`} size="sm">View subscription</Button><SubscriptionActions id={subscription.id} status={subscription.status} plan={subscription.plan} hasEndDate={!!subscription.endDate} portal /></div>
        </div>
      </article>)}</div> : <section className="rounded-xl border border-line bg-surface px-6 py-16 text-center"><h2 className="text-lg font-semibold">No subscriptions to show</h2><p className="mx-auto mt-3 max-w-md text-sm text-muted">Your subscriptions will appear here once your account is set up. If you expected to see one, contact your account manager.</p></section>}
      {data.total > PAGE_SIZE && <div className="rounded-xl border border-line bg-surface"><Pagination basePath="/portal" searchParams={params} page={data.page} pageSize={PAGE_SIZE} total={data.total} /></div>}
    </div></>;
}
export default function Page(props: { searchParams: Promise<Params> }) { return <Suspense fallback={<PagePending />}><PortalPage {...props} /></Suspense>; }

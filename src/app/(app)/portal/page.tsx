// Customer portal home: overdue alert, subscription cards and recent invoices.
import type { Metadata } from "next";
import Link from "next/link";
import { Button, PageHeader, formatDate } from "@/components";
import { formatINR } from "@/lib/money";
import { InvoiceTable } from "./InvoiceTable";
import { NoAccount } from "./NoAccount";
import { listPortalInvoices, listPortalSubscriptions, overdueSummary, RECENT_INVOICES } from "./queries";
import { getPortalScope } from "./scope";
import { SubscriptionCard } from "./SubscriptionCard";

export const metadata: Metadata = { title: "My subscriptions" };

export default async function PortalPage() {
  const scope = await getPortalScope();
  if (!scope.linked) return <NoAccount name={scope.displayName} />;
  const { customerId, today } = scope;

  const [subs, overdue, recent] = await Promise.all([
    listPortalSubscriptions(customerId),
    overdueSummary(customerId, today),
    listPortalInvoices(customerId, { page: 1, pageSize: RECENT_INVOICES, today }),
  ]);

  return (
    <>
      <PageHeader title="My subscriptions" description={`Hello, ${scope.displayName}. Here is what is on your account.`} />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        {overdue.count > 0 && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger sm:flex-row sm:items-center sm:justify-between"
          >
            <p>
              <strong>
                {overdue.count === 1 ? "1 invoice is overdue" : `${overdue.count} invoices are overdue`}
              </strong>
              {" · "}
              {overdue.count === 1 && overdue.oldest
                ? `${overdue.oldest.number} · ${formatINR(overdue.total)} was due ${formatDate(overdue.oldest.dueDate)}`
                : `${formatINR(overdue.total)} in total, the oldest due ${formatDate(overdue.oldest?.dueDate)}`}
            </p>
            <Button
              href="/portal/invoices?filter=overdue"
              variant="primary"
              className="min-h-11 shrink-0 md:min-h-10"
            >
              View invoices
            </Button>
          </div>
        )}

        <section aria-labelledby="subs-heading" className="flex flex-col gap-3">
          <h2 id="subs-heading" className="text-base font-semibold">
            Subscriptions
          </h2>
          {subs.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
              You have no subscriptions yet.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {subs.map((sub) => (
                <SubscriptionCard key={sub.id} sub={sub} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="inv-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="inv-heading" className="text-base font-semibold">
              Recent invoices
            </h2>
            {recent.total > RECENT_INVOICES && (
              <Link href="/portal/invoices" className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">
                See all {recent.total}
              </Link>
            )}
          </div>
          <InvoiceTable rows={recent.rows} today={today} />
        </section>
      </div>
    </>
  );
}

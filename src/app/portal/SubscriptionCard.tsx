// One subscription as a card: plan, status, next invoice, recurring amount and the customer's actions.
import Link from "next/link";
import { StatusBadge, formatDate } from "@/components";
import { formatINR } from "@/lib/money";
import { closeBlockedReason, periodLabel, recurringAmount, renewBlockedReason } from "./logic";
import type { PortalSubscription } from "./queries";
import { SubscriptionActions } from "./SubscriptionActions";

export function SubscriptionCard({ sub }: { sub: PortalSubscription }) {
  const nextInvoice = sub.status === "ACTIVE" ? sub.nextInvoiceDate : null;
  return (
    <li className="flex min-w-0 flex-col gap-4 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-semibold">
            <Link href={`/portal/subscriptions/${sub.id}`} className="hover:underline focus-visible:underline">
              {sub.plan.name}
            </Link>
          </h3>
          <p className="text-xs text-muted">{sub.number}</p>
        </div>
        <StatusBadge status={sub.status} />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Next invoice</dt>
          <dd className="font-medium">{formatDate(nextInvoice)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Amount</dt>
          <dd className="font-medium tabular-nums">
            {formatINR(recurringAmount(sub.lines))}{" "}
            <span className="text-xs font-normal text-muted">{periodLabel(sub.plan.periodUnit, sub.plan.periodCount)}</span>
          </dd>
        </div>
        {sub.endDate && (
          <div className="col-span-2">
            <dt className="text-xs text-muted">Current term ends</dt>
            <dd className="font-medium">{formatDate(sub.endDate)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-auto">
        <SubscriptionActions
          id={sub.id}
          number={sub.number}
          planName={sub.plan.name}
          renewBlocked={renewBlockedReason(sub)}
          closeBlocked={closeBlockedReason(sub)}
        />
      </div>
    </li>
  );
}

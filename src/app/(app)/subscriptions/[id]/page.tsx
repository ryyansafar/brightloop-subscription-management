// Subscription form view: status bar with the valid actions, details, lines and generated invoices.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, StatusBar } from "@/components";
import { getSubscription } from "../detail";
import { DetailsCard, LinesCard } from "./DetailCards";
import { SidePanel } from "./SidePanel";
import { SubscriptionActions } from "./SubscriptionActions";

export const metadata: Metadata = { title: "Subscription" };

const STEPS = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "CLOSED"] as const;

export default async function SubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  const data = Number.isInteger(id) && id > 0 ? await getSubscription(id) : null;
  if (!data) notFound();
  const { sub, renewTo } = data;

  return (
    <>
      <PageHeader title={sub.number} breadcrumbs={[{ label: "Subscriptions", href: "/subscriptions" }]} />
      {/* Keep the step row on one line on phones: tighter pills instead of an orphaned last step. */}
      <div className="[&_ol]:flex-nowrap [&_ol]:justify-between [&_ol_li>span:not([aria-hidden])]:px-1.5 [&_ol_li>span[aria-hidden]]:mx-0 sm:[&_ol_li>span:not([aria-hidden])]:px-3">
      <StatusBar
        steps={STEPS}
        current={sub.status}
        labels={{ QUOTATION: "Quote", CONFIRMED: "Confirmed" }}
        actions={
          <SubscriptionActions
            id={sub.id}
            number={sub.number}
            status={sub.status}
            pausable={sub.plan.pausable}
            closable={sub.plan.closable}
            renewable={sub.plan.renewable}
            hasEndDate={sub.endDate !== null}
            endDate={sub.endDate?.toISOString() ?? null}
            renewTo={renewTo?.toISOString() ?? null}
          />
        }
      />
      </div>
      <div className="grid grid-cols-1 gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <DetailsCard data={data} />
          <LinesCard data={data} />
        </div>
        <SidePanel data={data} today={new Date()} />
      </div>
    </>
  );
}

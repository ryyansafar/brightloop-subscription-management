import type { Metadata } from "next";
import { Suspense } from "react";
import { PagePending } from "@/lib/auth/ui/PagePending";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/current-user";
import { subscriptionDetail } from "@/app/(app)/subscriptions/queries";
import { SubscriptionView } from "@/app/(app)/subscriptions/SubscriptionView";
export const metadata: Metadata = { title: "My subscription" };
async function PortalSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(["CUSTOMER"]);
  const id = Number((await params).id);
  const subscription = Number.isSafeInteger(id) && id > 0 ? await subscriptionDetail(id) : null;
  if (!subscription) notFound();
  return <SubscriptionView subscription={subscription} portal />;
}
export default function Page(props: { params: Promise<{ id: string }> }) { return <Suspense fallback={<PagePending />}><PortalSubscriptionPage {...props} /></Suspense>; }

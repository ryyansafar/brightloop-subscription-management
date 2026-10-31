// Admin-only billing run page: preview what is due, run billing, see exactly what happened.
import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, StatCard } from "@/components";
import { countDue } from "@/lib/billing";
import { startOfDayUTC } from "@/lib/dates";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { BillingRunner } from "./BillingRunner";

export const metadata: Metadata = { title: "Billing run" };

async function BillingContent() {
  await connection();
  const request = new Request("http://app.local", { headers: { cookie: (await cookies()).toString() } });
  const user = await getSessionUser(request);
  // The API enforces this too; the redirect just keeps non-admins out of the screen.
  if (user?.role !== "ADMIN") redirect("/dashboard");

  const today = startOfDayUTC(new Date());
  const [due, drafts, active] = await Promise.all([
    countDue(today),
    db.invoice.count({ where: { status: "DRAFT" } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Billing run"
        description="Create invoices for every active subscription that is due. Safe to repeat: a period that already has an invoice is never billed twice."
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Due today" value={due.toLocaleString("en-IN")} hint="Active subscriptions to invoice" tone={due > 0 ? "warning" : "success"} />
          <StatCard label="Active subscriptions" value={active.toLocaleString("en-IN")} href="/subscriptions?status=ACTIVE" />
          <StatCard label="Draft invoices" value={drafts.toLocaleString("en-IN")} hint="Waiting to be confirmed" href="/invoices?filter=draft" />
        </div>
        <BillingRunner initialDue={due} todayIso={today.toISOString().slice(0, 10)} />
      </div>
    </>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<PageHeader title="Billing run" description="Loading what is due..." />}>
      <BillingContent />
    </Suspense>
  );
}

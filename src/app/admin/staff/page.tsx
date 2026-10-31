import type { Metadata } from "next";
import { Suspense } from "react";
import { PagePending } from "@/lib/auth/ui/PagePending";
import { PageHeader, Badge, formatDate } from "@/components";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/current-user";
import { LogoutButton } from "@/lib/auth/ui/LogoutButton";
import { AuthForm } from "@/app/(auth)/_components/AuthForm";

export const metadata: Metadata = { title: "Staff users" };
async function StaffPage() {
  await requirePageRole(["ADMIN"]);
  const staff = await db.user.findMany({ where: { role: "STAFF" }, select: { id: true, name: true, email: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  return <><PageHeader title="Staff users" description="Give your team the access they need to keep subscriptions moving." actions={<LogoutButton />} />
    <div className="grid grid-cols-1 items-start gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="overflow-hidden rounded-xl border border-line bg-surface"><div className="flex items-center justify-between border-b border-line p-5"><h2 className="font-semibold">Your team</h2><Badge>{staff.length} staff</Badge></div>
        {staff.length === 0 ? <p className="p-8 text-sm text-muted">No staff accounts yet. Create one to get your team started.</p> : <ul className="divide-y divide-line">{staff.map((user) => <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="flex min-w-0 items-center gap-3"><span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary">{user.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="font-medium">{user.name}</p><p className="break-all text-sm text-muted">{user.email}</p></div></div><span className="text-xs text-muted">Added {formatDate(user.createdAt)}</span></li>)}</ul>}
      </section>
      <section className="rounded-xl border border-line bg-surface p-5"><h2 className="font-semibold">Add a team member</h2><p className="mb-6 mt-2 text-sm text-muted">Staff can manage day-to-day subscriptions, invoices and payments. Administrator settings stay restricted.</p><AuthForm mode="staff" /></section>
    </div>
  </>;
}
export default function Page() { return <Suspense fallback={<PagePending />}><StaffPage /></Suspense>; }

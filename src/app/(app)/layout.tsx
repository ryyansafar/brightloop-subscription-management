// Owner: fathima. Shell for the back-office pages (dashboard, subscriptions, invoices, catalog...).
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppShell, ToastProvider } from "@/components";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/** The signed-in user, using Pankaj's session check (signature, expiry, password version). */
async function currentUser() {
  const cookie = (await cookies()).toString();
  const session = await getSessionUser(new Request("http://app.local", { headers: { cookie } }));
  if (!session) return null;
  const { name } = await db.user.findUniqueOrThrow({ where: { id: session.id }, select: { name: true } });
  return { name, role: session.role };
}

async function SignedInShell({ children }: { children: ReactNode }) {
  // src/proxy.ts already redirects signed-out visitors; this covers a stale or tampered cookie.
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <AppShell role={user.role} userName={user.name}>
      {children}
    </AppShell>
  );
}

// Shown for a moment while the session is read (Next 16 needs request data behind Suspense).
function ShellPlaceholder() {
  return (
    <div className="flex min-h-screen w-full" aria-busy>
      <div className="hidden w-60 shrink-0 border-r border-line bg-surface md:block" />
      <div className="flex-1 animate-pulse p-6">
        <div className="h-6 w-40 rounded bg-surface-2" />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <Suspense fallback={<ShellPlaceholder />}>
        <SignedInShell>{children}</SignedInShell>
      </Suspense>
    </ToastProvider>
  );
}

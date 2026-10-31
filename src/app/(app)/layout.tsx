// Owner: fathima. Shell for the back-office pages (dashboard, subscriptions, invoices, catalog...).
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppShell, ToastProvider } from "@/components";
import { getCurrentUser } from "@/lib/auth/current-user";

async function SignedInShell({ children }: { children: ReactNode }) {
  // Pankaj's request-cached session check. src/proxy.ts already redirects signed-out
  // visitors; this covers a stale or tampered cookie.
  const user = await getCurrentUser();
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

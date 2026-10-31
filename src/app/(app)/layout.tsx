// Owner: fathima. Shell for the back-office pages (dashboard, subscriptions, invoices, catalog...).
import type { ReactNode } from "react";
import { AppShell, ToastProvider } from "@/components";
import type { Role } from "@/lib/state";

// TODO(pankaj): replace with the signed-in user from the session once src/lib/auth is in.
// The menu below is filtered by this role.
async function currentUser(): Promise<{ name: string; role: Role }> {
  return { name: "Admin", role: "ADMIN" };
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return (
    <ToastProvider>
      <AppShell role={user.role} userName={user.name}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}

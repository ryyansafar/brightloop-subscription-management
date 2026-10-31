import { Suspense, type ReactNode } from "react";
import { AppShell, ToastProvider } from "@/components";
import type { Role } from "@/lib/state";
import { requirePageRole } from "../current-user";

async function ProtectedShell({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const user = await requirePageRole(roles);
  return <AppShell role={user.role} userName={user.name}>{children}</AppShell>;
}

/** Portal and staff pages use the same shell and tokens as the existing back office. */
export function WorkspaceShell({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  return <ToastProvider><Suspense fallback={<div className="p-6 text-sm text-muted">Opening your workspace…</div>}>
    <ProtectedShell roles={roles}>{children}</ProtectedShell>
  </Suspense></ToastProvider>;
}

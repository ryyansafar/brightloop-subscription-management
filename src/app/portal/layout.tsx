import type { ReactNode } from "react";
import { WorkspaceShell } from "@/lib/auth/ui/WorkspaceShell";
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell roles={["CUSTOMER"]}>{children}</WorkspaceShell>;
}

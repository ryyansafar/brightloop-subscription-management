import type { ReactNode } from "react";
import { WorkspaceShell } from "@/lib/auth/ui/WorkspaceShell";
export default function StaffLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell roles={["ADMIN"]}>{children}</WorkspaceShell>;
}

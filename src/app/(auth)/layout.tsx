import type { ReactNode } from "react";

// AuthScreen owns the shared responsive shell; avoid nesting two page layouts.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}

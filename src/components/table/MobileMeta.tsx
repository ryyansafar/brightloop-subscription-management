// Owner: fathima. Secondary line under a cell value, shown on phones only (where the matching column is hidden).
import type { ReactNode } from "react";

/** `below` is the breakpoint at which the matching column reappears: "md" (default) or "lg". */
export function MobileMeta({ children, below = "md" }: { children: ReactNode; below?: "md" | "lg" }) {
  const hide = below === "lg" ? "lg:hidden" : "md:hidden";
  return <span className={`mt-0.5 block text-xs font-normal text-muted ${hide}`}>{children}</span>;
}

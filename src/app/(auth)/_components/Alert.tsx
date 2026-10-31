// Inline banner. Errors use role="alert" (announced at once); success uses role="status" (polite).
import type { ReactNode } from "react";

type AlertTone = "error" | "success" | "info";

const TONES: Record<AlertTone, string> = {
  error: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
};

export function Alert({ tone, children }: { tone: AlertTone; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md px-3 py-2.5 text-sm ${TONES[tone]}`}>
      {children}
    </div>
  );
}

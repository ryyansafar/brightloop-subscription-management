// Owner: fathima. Odoo-style status bar: action buttons on the left, steps on the right.
import type { ReactNode } from "react";
import { humanize } from "./ui/Badge";

interface StatusBarProps {
  /** Ordered steps, e.g. ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "CLOSED"]. */
  steps: readonly string[];
  current: string;
  /** Custom labels; defaults to the humanized step name. */
  labels?: Partial<Record<string, string>>;
  /** Transition buttons (e.g. <Button>Confirm</Button>). */
  actions?: ReactNode;
}

export function StatusBar({ steps, current, labels = {}, actions }: StatusBarProps) {
  const currentIndex = steps.indexOf(current);
  // A state outside the main flow (e.g. PAUSED, CANCELLED) is shown as an extra current step.
  const shown = currentIndex === -1 ? [...steps, current] : steps;
  const activeIndex = currentIndex === -1 ? shown.length - 1 : currentIndex;

  return (
    <div className="no-print flex flex-col gap-3 border-b border-line bg-surface px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-2">{actions}</div>
      <ol className="flex flex-wrap items-center text-xs font-medium" aria-label="Status">
        {shown.map((step, i) => {
          const state = i === activeIndex ? "current" : i < activeIndex ? "done" : "todo";
          return (
            <li key={step} className="flex items-center">
              {i > 0 && <span aria-hidden className="mx-1 text-line">›</span>}
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={
                  "rounded-full px-3 py-1 " +
                  (state === "current"
                    ? "bg-primary text-on-primary"
                    : state === "done"
                      ? "text-foreground"
                      : "text-muted")
                }
              >
                {labels[step] ?? humanize(step)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

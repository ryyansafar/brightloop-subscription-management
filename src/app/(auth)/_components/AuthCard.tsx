// White card used by every auth screen. `footer` is the grey strip under the form.
import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Rendered above the title, inside the card (e.g. tabs). */
  top?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer, top }: AuthCardProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      {top}
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="border-t border-line bg-surface-2 px-5 py-3 text-center text-sm text-muted">{footer}</div>}
    </section>
  );
}

/** Text link with the 44px touch target the auth screens need. */
export const AUTH_LINK =
  "inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline-offset-2 hover:underline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

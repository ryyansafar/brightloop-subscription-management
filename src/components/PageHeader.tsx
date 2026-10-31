// Owner: fathima. Page title row with optional breadcrumb trail and action buttons.
import Link from "next/link";
import type { ReactNode } from "react";

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  /** Parent pages, e.g. [{ label: "Invoices", href: "/invoices" }]. */
  breadcrumbs?: Crumb[];
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, breadcrumbs = [], description, actions }: PageHeaderProps) {
  return (
    <header className="no-print flex flex-col gap-3 border-b border-line bg-surface px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
      <div className="min-w-0">
        {breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-sm text-muted">
            {breadcrumbs.map((c) => (
              <span key={c.label} className="flex items-center gap-1">
                {c.href ? (
                  <Link href={c.href} className="text-primary hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  c.label
                )}
                <span aria-hidden>/</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-xl font-semibold text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

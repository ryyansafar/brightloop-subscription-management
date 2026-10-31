"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface CatalogTab {
  label: string;
  href: string;
  adminOnly?: boolean;
}

const TABS: CatalogTab[] = [
  { label: "Products", href: "/catalog/products" },
  { label: "Plans", href: "/catalog/plans" },
  { label: "Quotation templates", href: "/catalog/templates" },
  { label: "Discounts", href: "/catalog/discounts", adminOnly: true },
  { label: "Taxes", href: "/catalog/taxes", adminOnly: true },
];

export interface CatalogNavProps {
  activeHref?: string;
}

export const CatalogNav: React.FC<CatalogNavProps> = ({ activeHref } = {}) => {
  let pathname = activeHref;
  try {
    const hookPath = usePathname();
    if (!pathname && hookPath) {
      pathname = hookPath;
    }
  } catch {
    // Falls back gracefully when usePathname is unavailable (e.g. static markup rendering in tests)
  }

  return (
    <nav aria-label="Catalog navigation" className="flex border-b border-line gap-2 overflow-x-auto pb-px">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || (Boolean(pathname) && pathname!.startsWith(`${tab.href}/`));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground hover:border-line"
            }`}
          >
            <span>{tab.label}</span>
            {tab.adminOnly && (
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-surface-2 text-muted">
                Admin
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
};

export const CatalogSubNav = CatalogNav;

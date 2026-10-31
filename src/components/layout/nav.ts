// Owner: fathima. Sidebar menu and who can see each item. The server still enforces roles;
// this only hides what a role cannot use.
import type { Role } from "@/lib/state";

export interface NavItem {
  label: string;
  href: string;
  roles: readonly Role[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

const TEAM = ["ADMIN", "STAFF"] as const;
const ADMIN = ["ADMIN"] as const;
const CUSTOMER = ["CUSTOMER"] as const;

export const NAV: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", roles: TEAM }],
  },
  {
    title: "Sales",
    items: [
      { label: "Subscriptions", href: "/subscriptions", roles: TEAM },
      { label: "Invoices", href: "/invoices", roles: TEAM },
      { label: "Payments", href: "/payments", roles: TEAM },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products", href: "/catalog/products", roles: TEAM },
      { label: "Plans", href: "/catalog/plans", roles: TEAM },
      { label: "Quotation templates", href: "/catalog/templates", roles: TEAM },
      { label: "Discounts", href: "/catalog/discounts", roles: ADMIN },
      { label: "Taxes", href: "/catalog/taxes", roles: ADMIN },
    ],
  },
  {
    title: "Settings",
    items: [{ label: "Staff users", href: "/admin/staff", roles: ADMIN }],
  },
  {
    items: [
      { label: "My subscriptions", href: "/portal", roles: CUSTOMER },
      { label: "My invoices", href: "/portal/invoices", roles: CUSTOMER },
    ],
  },
];

/** The menu for one role, with empty sections removed. */
export function navFor(role: Role): NavSection[] {
  return NAV.map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(role)) })).filter(
    (s) => s.items.length > 0,
  );
}

/** Highlight a menu item on its own page and on its sub-pages (/invoices/42). */
export function isActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === href || pathname.startsWith("/portal/subscriptions/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

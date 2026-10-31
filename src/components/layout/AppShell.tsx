"use client";
// Owner: fathima. Sidebar + top bar + content. On phones the sidebar becomes a slide-in drawer.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Role } from "@/lib/state";
import { isActive, navFor } from "./nav";
import { UserMenu } from "./UserMenu";

interface AppShellProps {
  role: Role;
  userName: string;
  children: ReactNode;
}

/** Stitch logo: concentric "loop" rings on an indigo tile. */
function LogoMark() {
  return (
    <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-primary text-on-primary shadow-sm">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

export function AppShell({ role, userName, children }: AppShellProps) {
  const pathname = usePathname();
  // The drawer remembers the page it was opened on, so it closes by itself after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const sections = navFor(role);

  return (
    <div className="flex min-h-screen w-full">
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="no-print fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-line bg-surface transition-transform md:visible md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
          <LogoMark />
          <span className="font-display text-lg font-bold tracking-tight">Brightloop</span>
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-3">
          {sections.map((section, i) => (
            <div key={section.title ?? i} className="mb-3">
              {section.title && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">{section.title}</p>
              )}
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`relative block rounded-md px-3 py-1.5 text-sm ${
                          active
                            ? "bg-primary-soft font-semibold text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
                            : "text-muted hover:bg-surface-2 hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <UserMenu name={userName} role={role} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="rounded-md border border-line px-2.5 py-1.5 text-sm"
          >
            ☰
          </button>
          <LogoMark />
          <span className="font-display font-bold tracking-tight">Brightloop</span>
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

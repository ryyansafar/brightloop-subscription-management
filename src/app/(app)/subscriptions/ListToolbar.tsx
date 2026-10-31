// Status chips and search for the subscription list. Same URL contract as the shared toolbar,
// with 40px controls on phones.
import Link from "next/link";
import { hrefWith, param, type Params } from "@/components";

const STATUS_OPTIONS = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "PAUSED", "CLOSED"].map((s) => ({
  label: s.charAt(0) + s.slice(1).toLowerCase(),
  value: s.toLowerCase(),
}));

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap md:min-h-8 md:px-3 md:text-xs " +
        (active ? "border-primary bg-primary-soft text-primary" : "border-line text-muted hover:text-foreground")
      }
    >
      {label}
    </Link>
  );
}

export function ListToolbar({ params }: { params: Params }) {
  const current = param(params, "status");
  const to = (value?: string) => hrefWith("/subscriptions", params, { status: value, page: undefined, due: undefined });

  return (
    <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        <Chip href={to(undefined)} active={!current} label="All" />
        {STATUS_OPTIONS.map((o) => (
          <Chip key={o.value} href={to(o.value)} active={current === o.value} label={o.label} />
        ))}
      </nav>

      <form action="/subscriptions" role="search" className="flex gap-2">
        {Object.entries(params).map(([key, value]) =>
          key !== "q" && key !== "page" && typeof value === "string" ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        <input
          type="search"
          name="q"
          aria-label="Search by number or customer"
          defaultValue={param(params, "q") ?? ""}
          placeholder="Number or customer"
          className="min-h-10 w-full rounded-md border border-line bg-surface px-3 text-sm lg:w-64"
        />
        <button type="submit" className="min-h-10 rounded-md border border-line px-4 text-sm hover:bg-surface-2">
          Search
        </button>
      </form>
    </div>
  );
}

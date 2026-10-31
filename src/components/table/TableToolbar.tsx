// Owner: fathima. Filter chips and a search box above a DataTable. Plain links and a GET form.
import Link from "next/link";
import { hrefWith, param, type Params } from "./url";

export interface FilterGroup {
  /** URL param, e.g. "status". */
  param: string;
  /** Label of the "no filter" chip; defaults to "All". */
  allLabel?: string;
  options: { label: string; value: string }[];
  /** "tabs" = Stitch-style underlined tabs across the top of the table; default is chips. */
  variant?: "chips" | "tabs";
  /** Optional count per option value (and `all`), shown as a pill next to the label. */
  counts?: Partial<Record<string, number>> & { all?: number };
}

interface TableToolbarProps {
  basePath: string;
  searchParams: Params;
  filters?: FilterGroup[];
  search?: { param?: string; placeholder?: string };
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        "inline-flex min-h-10 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap md:min-h-0 md:py-1 " +
        (active ? "border-primary bg-primary-soft text-primary" : "border-line text-muted hover:text-foreground")
      }
    >
      {label}
    </Link>
  );
}

function Tab({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        "-mb-px inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm whitespace-nowrap " +
        (active ? "border-primary font-semibold text-primary" : "border-transparent text-muted hover:text-foreground")
      }
    >
      {label}
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 py-px text-[11px] font-medium tabular-nums ${
            active ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted"
          }`}
        >
          {count.toLocaleString("en-IN")}
        </span>
      )}
    </Link>
  );
}

export function TableToolbar({ basePath, searchParams, filters = [], search }: TableToolbarProps) {
  const searchKey = search?.param ?? "q";
  // Changing a filter resets paging.
  const linkFor = (group: FilterGroup) => (value?: string) =>
    hrefWith(basePath, searchParams, { [group.param]: value, page: undefined });
  const tabs = filters.filter((g) => g.variant === "tabs");
  const chips = filters.filter((g) => g.variant !== "tabs");

  return (
    <>
      {tabs.map((group) => {
        const current = param(searchParams, group.param);
        const to = linkFor(group);
        return (
          <nav key={group.param} aria-label="Filter" className="flex overflow-x-auto overflow-y-hidden border-b border-line px-2 [scrollbar-width:none]">
            <Tab href={to(undefined)} active={!current} label={group.allLabel ?? "All"} count={group.counts?.all} />
            {group.options.map((o) => (
              <Tab
                key={o.value}
                href={to(o.value)}
                active={current === o.value}
                label={o.label}
                count={group.counts?.[o.value]}
              />
            ))}
          </nav>
        );
      })}

      {(chips.length > 0 || search) && (
        <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            {chips.map((group) => {
              const current = param(searchParams, group.param);
              const to = linkFor(group);
              return (
                <div key={group.param} className="flex flex-wrap gap-2">
                  <Chip href={to(undefined)} active={!current} label={group.allLabel ?? "All"} />
                  {group.options.map((o) => (
                    <Chip key={o.value} href={to(o.value)} active={current === o.value} label={o.label} />
                  ))}
                </div>
              );
            })}
          </div>
          {search && <SearchForm basePath={basePath} searchParams={searchParams} searchKey={searchKey} placeholder={search.placeholder} />}
        </div>
      )}
    </>
  );
}

function SearchForm({
  basePath,
  searchParams,
  searchKey,
  placeholder,
}: {
  basePath: string;
  searchParams: Params;
  searchKey: string;
  placeholder?: string;
}) {
  return (
    <form action={basePath} className="flex gap-2" role="search">
      {/* Keep the other params (filters) when searching. */}
      {Object.entries(searchParams).map(([key, value]) =>
        key !== searchKey && key !== "page" && typeof value === "string" ? (
          <input key={key} type="hidden" name={key} value={value} />
        ) : null,
      )}
      <input
        type="search"
        name={searchKey}
        defaultValue={param(searchParams, searchKey) ?? ""}
        placeholder={placeholder ?? "Search…"}
        aria-label={placeholder ?? "Search"}
        className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm md:h-9 lg:w-64"
      />
      <button
        type="submit"
        className="h-10 rounded-md border border-line px-3 text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:h-9"
      >
        Search
      </button>
    </form>
  );
}

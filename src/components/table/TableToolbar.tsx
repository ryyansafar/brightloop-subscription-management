// Owner: fathima. Filter chips and a search box above a DataTable. Plain links and a GET form.
import Link from "next/link";
import { hrefWith, param, type Params } from "./url";

export interface FilterGroup {
  /** URL param, e.g. "status". */
  param: string;
  /** Label of the "no filter" chip; defaults to "All". */
  allLabel?: string;
  options: { label: string; value: string }[];
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

export function TableToolbar({ basePath, searchParams, filters = [], search }: TableToolbarProps) {
  const searchKey = search?.param ?? "q";

  return (
    <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-2">
        {filters.map((group) => {
          const current = param(searchParams, group.param);
          // Changing a filter resets paging.
          const to = (value?: string) => hrefWith(basePath, searchParams, { [group.param]: value, page: undefined });
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

      {search && (
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
            placeholder={search.placeholder ?? "Search…"}
            aria-label={search.placeholder ?? "Search"}
            className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm md:h-9 lg:w-64"
          />
          <button type="submit" className="h-10 rounded-md border border-line px-3 text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:h-9">
            Search
          </button>
        </form>
      )}
    </div>
  );
}

// Owner: fathima. Odoo-style list view. Works in server components: filters, search and paging are links.
import Link from "next/link";
import type { ReactNode } from "react";
import { Pagination } from "./Pagination";
import { TableToolbar, type FilterGroup } from "./TableToolbar";
import { hrefWith, nextSort, sortParam, type Params } from "./url";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Hide on phones to keep the table narrow. */
  hideOnMobile?: boolean;
  /** Hide below this breakpoint (md = 768px, lg = 1024px, xl = 1280px). Wins over hideOnMobile. */
  hideBelow?: "md" | "lg" | "xl";
  /** Keep the cell on one line and pinned to the right edge (for Edit/Archive actions). */
  pinRight?: boolean;
  /** Header becomes a link that sets ?sort=<key>&dir=asc|desc. The page reads it with sortParam(). */
  sortable?: boolean;
}

const HIDE_BELOW = { md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;

/** Visibility classes for a column: hideBelow, else hideOnMobile (md). */
export function columnVisibility(c: Pick<Column<unknown>, "hideBelow" | "hideOnMobile">): string {
  if (c.hideBelow) return HIDE_BELOW[c.hideBelow];
  return c.hideOnMobile ? HIDE_BELOW.md : "";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Clicking a row opens this URL (the form view). */
  rowHref?: (row: T) => string;
  /** Path of the list page and its current search params; needed for filters/search/paging. */
  basePath: string;
  searchParams?: Params;
  filters?: FilterGroup[];
  search?: { param?: string; placeholder?: string };
  pagination?: { page: number; pageSize: number; total: number };
  emptyMessage?: string;
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" };

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  basePath,
  searchParams = {},
  filters,
  search,
  pagination,
  emptyMessage = "Nothing to show yet.",
}: DataTableProps<T>) {
  const sort = sortParam(
    searchParams,
    columns.filter((c) => c.sortable).map((c) => c.key),
  );
  const cellClass =(c: Column<T>) =>
    `px-3 py-2.5 md:px-4 ${ALIGN[c.align ?? "left"]} ${columnVisibility(c)} ${
      c.pinRight ? "sticky right-0 whitespace-nowrap" : ""
    }`;

  return (
    <div className="rounded-lg border border-line bg-surface shadow-sm">
      {(filters?.length || search) && (
        <TableToolbar basePath={basePath} searchParams={searchParams} filters={filters} search={search} />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
            <tr>
              {columns.map((c) => {
                const active = c.sortable && sort.sort === c.key;
                const ariaSort = c.sortable ? (active ? (sort.dir === "desc" ? "descending" : "ascending") : "none") : undefined;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={`${cellClass(c)} font-medium ${c.pinRight ? "bg-surface-2" : ""}`}
                  >
                    {c.sortable ? (
                      <Link
                        href={hrefWith(basePath, searchParams, nextSort(sort, c.key))}
                        className="inline-flex min-h-10 items-center gap-1 uppercase hover:text-foreground md:min-h-0"
                      >
                        {c.header}
                        <span aria-hidden className={active ? "text-foreground" : "opacity-40"}>
                          {active ? (sort.dir === "desc" ? "▼" : "▲") : "↕"}
                        </span>
                      </Link>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const href = rowHref?.(row);
                return (
                  <tr key={rowKey(row)} className="group border-b border-line last:border-0 hover:bg-surface-2">
                    {columns.map((c, i) => {
                      const content = c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "");
                      return (
                        <td key={c.key} className={`${cellClass(c)} tabular-nums ${c.pinRight ? "bg-surface group-hover:bg-surface-2" : ""}`}>
                          {/* Only the first cell is a link, so buttons in other cells keep working. */}
                          {href && i === 0 ? (
                            <Link href={href} className="inline-flex min-h-10 items-center font-medium text-primary hover:underline md:min-h-0">
                              {content}
                            </Link>
                          ) : (
                            content
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && <Pagination basePath={basePath} searchParams={searchParams} {...pagination} />}
    </div>
  );
}

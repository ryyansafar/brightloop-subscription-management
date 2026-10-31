// Owner: fathima. Odoo-style list view. Works in server components: filters, search and paging are links.
import Link from "next/link";
import type { ReactNode } from "react";
import { Pagination } from "./Pagination";
import { TableToolbar, type FilterGroup } from "./TableToolbar";
import type { Params } from "./url";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Hide on phones to keep the table narrow. */
  hideOnMobile?: boolean;
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
  const cellClass = (c: Column<T>) =>
    `px-4 py-2.5 ${ALIGN[c.align ?? "left"]} ${c.hideOnMobile ? "hidden md:table-cell" : ""}`;

  return (
    <div className="rounded-lg border border-line bg-surface">
      {(filters?.length || search) && (
        <TableToolbar basePath={basePath} searchParams={searchParams} filters={filters} search={search} />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`${cellClass(c)} font-medium`}>
                  {c.header}
                </th>
              ))}
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
                  <tr key={rowKey(row)} className="border-b border-line last:border-0 hover:bg-surface-2">
                    {columns.map((c, i) => {
                      const content = c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "");
                      return (
                        <td key={c.key} className={`${cellClass(c)} tabular-nums`}>
                          {/* Only the first cell is a link, so buttons in other cells keep working. */}
                          {href && i === 0 ? (
                            <Link href={href} className="font-medium text-primary hover:underline">
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

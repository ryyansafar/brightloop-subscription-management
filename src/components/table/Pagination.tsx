// Owner: fathima. "1–20 of 3,000  ‹ ›" pager, Odoo style. Pages are links (?page=N).
import Link from "next/link";
import { hrefWith, type Params } from "./url";

interface PaginationProps {
  basePath: string;
  searchParams: Params;
  page: number;
  pageSize: number;
  total: number;
}

export function Pagination({ basePath, searchParams, page, pageSize, total }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const to = (p: number) => hrefWith(basePath, searchParams, { page: p === 1 ? undefined : String(p) });

  const arrow = (target: number, label: string, disabled: boolean) =>
    disabled ? (
      <span aria-disabled className="rounded-md border border-line px-2.5 py-1 text-muted opacity-50">
        {label}
      </span>
    ) : (
      <Link href={to(target)} className="rounded-md border border-line px-2.5 py-1 hover:bg-surface-2" aria-label={label === "‹" ? "Previous page" : "Next page"}>
        {label}
      </Link>
    );

  return (
    <div className="flex items-center justify-end gap-3 border-t border-line px-4 py-2 text-sm text-muted">
      <span className="tabular-nums">
        {fmt(first)}–{fmt(last)} of {fmt(total)}
      </span>
      <div className="flex gap-1">
        {arrow(page - 1, "‹", page <= 1)}
        {arrow(page + 1, "›", page >= pages)}
      </div>
    </div>
  );
}

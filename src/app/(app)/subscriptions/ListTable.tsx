// Subscription list: sortable table from md up, cards on phones, 40px pager.
import Link from "next/link";
import { StatusBadge, formatDate, hrefWith, type Params } from "@/components";
import { formatINR } from "@/lib/money";
import { ListToolbar } from "./ListToolbar";
import { PAGE_SIZE, type SortDir, type SortKey, type SubscriptionRow } from "./queries";

interface ListTableProps {
  rows: SubscriptionRow[];
  params: Params;
  sort: SortKey | undefined;
  dir: SortDir;
  page: number;
  total: number;
}

const TH = "px-4 py-2.5 font-medium";

function SortHeader({ label, field, params, sort, dir, right }: { label: string; field: SortKey; params: Params; sort?: SortKey; dir: SortDir; right?: boolean }) {
  const active = sort === field;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`${TH} ${right ? "text-right" : "text-left"}`}
    >
      <Link
        href={hrefWith("/subscriptions", params, { sort: field, dir: nextDir, page: undefined })}
        className={`inline-flex items-center gap-1 uppercase hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        <span aria-hidden className={active ? "" : "opacity-40"}>{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </Link>
    </th>
  );
}

function Pager({ params, page, total }: { params: Params; page: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const to = (p: number) => hrefWith("/subscriptions", params, { page: p === 1 ? undefined : String(p) });
  const arrow = "inline-flex size-10 items-center justify-center rounded-md border border-line";

  return (
    <div className="flex items-center justify-end gap-3 border-t border-line px-4 py-2 text-sm text-muted">
      <span className="tabular-nums">
        {fmt(first)}–{fmt(last)} of {fmt(total)}
      </span>
      {page <= 1 ? (
        <span aria-disabled className={`${arrow} opacity-50`}>‹</span>
      ) : (
        <Link href={to(page - 1)} aria-label="Previous page" className={`${arrow} hover:bg-surface-2`}>‹</Link>
      )}
      {page >= pages ? (
        <span aria-disabled className={`${arrow} opacity-50`}>›</span>
      ) : (
        <Link href={to(page + 1)} aria-label="Next page" className={`${arrow} hover:bg-surface-2`}>›</Link>
      )}
    </div>
  );
}

export function ListTable({ rows, params, sort, dir, page, total }: ListTableProps) {
  const sortProps = { params, sort, dir };
  return (
    <div className="rounded-lg border border-line bg-surface">
      <ListToolbar params={params} />

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">No subscriptions match these filters.</p>
      ) : (
        <>
          <ul className="divide-y divide-line md:hidden" aria-label="Subscriptions">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/subscriptions/${r.id}`} className="grid min-h-16 grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface-2">
                  <span className="font-medium text-primary">{r.number}</span>
                  <StatusBadge status={r.status} />
                  <span className="truncate text-sm" title={r.customer.name}>{r.customer.name}</span>
                  <span className="text-right text-sm font-medium tabular-nums">{formatINR(r.amount)}</span>
                  <span className="truncate text-xs text-muted">{r.plan.name}</span>
                  <span className="text-right text-xs text-muted">Next: {formatDate(r.nextInvoiceDate)}</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs tracking-wide text-muted">
                <tr>
                  <SortHeader label="Number" field="number" {...sortProps} />
                  <th scope="col" className={`${TH} text-left uppercase`}>Customer</th>
                  <th scope="col" className={`${TH} text-left uppercase`}>Plan</th>
                  <th scope="col" className={`${TH} text-left uppercase`}>Status</th>
                  <SortHeader label="Start date" field="start" {...sortProps} />
                  <th scope="col" className={`${TH} text-left uppercase`}>Expiry</th>
                  <SortHeader label="Next invoice" field="next" {...sortProps} />
                  <SortHeader label="Recurring" field="amount" right {...sortProps} />
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      <Link href={`/subscriptions/${r.id}`} className="font-medium whitespace-nowrap text-primary hover:underline">{r.number}</Link>
                    </td>
                    <td className="max-w-64 truncate px-4 py-2.5" title={r.customer.name}>{r.customer.name}</td>
                    <td className="px-4 py-2.5">{r.plan.name}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(r.startDate)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(r.endDate)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(r.nextInvoiceDate)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{formatINR(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pager params={params} page={page} total={total} />
    </div>
  );
}

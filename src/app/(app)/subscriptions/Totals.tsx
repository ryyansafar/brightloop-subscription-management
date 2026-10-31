// Subtotal / discount / tax / total block. Works in server and client components.
import { formatINR } from "@/lib/money";

interface TotalsProps {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  note?: string;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-6 py-1 ${strong ? "mt-1 border-t border-line pt-2 text-base font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function Totals({ subtotal, discountTotal, taxTotal, total, note }: TotalsProps) {
  return (
    <div className="border-t border-line px-4 py-3">
      <dl className="ml-auto w-full max-w-xs text-sm" aria-label="Totals">
        <Row label="Subtotal" value={formatINR(subtotal)} />
        {discountTotal > 0 && <Row label="Discount" value={`−${formatINR(discountTotal)}`} />}
        <Row label="Tax" value={formatINR(taxTotal)} />
        <Row label="Total" value={formatINR(total)} strong />
      </dl>
      {note && <p className="mt-2 text-right text-xs text-muted">{note}</p>}
    </div>
  );
}

"use client";
// Editable order lines. Keyboard: Enter in a quantity adds a line (when it is the last one), Tab walks the row.
import { useEffect, useRef } from "react";
import { Input, Select, buttonClasses } from "@/components";
import { formatINR } from "@/lib/money";
import { lineAmounts, unitPriceFor } from "./logic";
import type { CatalogProduct, CatalogTax, EditorLine } from "./types";

interface LineEditorProps {
  lines: readonly EditorLine[];
  products: readonly CatalogProduct[];
  taxes: readonly CatalogTax[];
  defaultTaxId: number | null;
  onChange: (lines: EditorLine[]) => void;
  error?: string;
}

const ROW =
  "grid grid-cols-2 gap-x-3 gap-y-2 border-b border-line px-4 py-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_5rem_6rem_7rem_7rem_2.75rem] xl:items-center xl:py-2";
const FIELD_LABEL = "text-xs text-muted xl:sr-only";

let counter = 0;
export function newLine(taxRateId: number | null, init: Partial<EditorLine> = {}): EditorLine {
  counter += 1;
  return { key: `l${counter}`, productId: null, variantOptionId: null, quantity: 1, taxRateId, ...init };
}

export function LineEditor({ lines, products, taxes, defaultTaxId, onChange, error }: LineEditorProps) {
  const focusKey = useRef<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const productById = new Map(products.map((p) => [p.id, p]));

  useEffect(() => {
    const key = focusKey.current;
    if (!key) return;
    focusKey.current = null;
    rootRef.current?.querySelector<HTMLElement>(`[data-line="${key}"] select`)?.focus();
  }, [lines]);

  function update(key: string, patch: Partial<EditorLine>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function add() {
    const line = newLine(defaultTaxId);
    onChange([...lines, line]);
    focusKey.current = line.key;
  }

  function remove(key: string) {
    onChange(lines.filter((l) => l.key !== key));
    addRef.current?.focus();
  }

  return (
    <div ref={rootRef}>
      <div
        className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_5rem_6rem_7rem_7rem_2.75rem] gap-x-3 border-b border-line bg-surface-2 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted xl:grid"
        aria-hidden
      >
        <span>Product</span>
        <span>Variant</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Unit price</span>
        <span>Tax</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      {lines.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">No lines yet. Add a product or pick a template.</p>}

      {lines.map((line, index) => {
        const product = line.productId ? productById.get(line.productId) : undefined;
        const variant = product?.variants.find((v) => v.id === line.variantOptionId);
        const unit = product ? unitPriceFor(product.salesPrice, variant?.extraPrice ?? 0) : 0;
        const gross = lineAmounts({ quantity: line.quantity, unitPrice: unit, taxBps: 0 }).gross;
        const n = index + 1;
        return (
          <div key={line.key} data-line={line.key} className={ROW}>
            <div className="col-span-2 flex flex-col gap-1 xl:col-span-1">
              <span className={FIELD_LABEL}>Product</span>
              <Select
                aria-label={`Product, line ${n}`}
                className="min-h-11 xl:min-h-10"
                value={line.productId ?? ""}
                onChange={(e) => update(line.key, { productId: e.target.value ? Number(e.target.value) : null, variantOptionId: null })}
              >
                <option value="">Choose a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="col-span-2 flex flex-col gap-1 xl:col-span-1">
              <span className={FIELD_LABEL}>Variant</span>
              <Select
                aria-label={`Variant, line ${n}`}
                className="min-h-11 xl:min-h-10"
                disabled={!product || product.variants.length === 0}
                value={line.variantOptionId ?? ""}
                onChange={(e) => update(line.key, { variantOptionId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">{product && product.variants.length > 0 ? "No variant" : "—"}</option>
                {product?.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.attribute}: {v.value}
                    {v.extraPrice ? ` (+${formatINR(v.extraPrice)})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className={FIELD_LABEL} htmlFor={`qty-${line.key}`}>Quantity</label>
              <Input
                id={`qty-${line.key}`}
                aria-label={`Quantity, line ${n}`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className="min-h-11 text-right xl:min-h-10"
                value={Number.isNaN(line.quantity) ? "" : line.quantity}
                onChange={(e) => update(line.key, { quantity: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    if (index === lines.length - 1) add();
                  }
                }}
              />
            </div>

            <div className="flex flex-col gap-1 xl:items-end">
              <span className={FIELD_LABEL}>Unit price</span>
              <span className="flex min-h-11 items-center tabular-nums xl:min-h-10">{product ? formatINR(unit) : "—"}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className={FIELD_LABEL}>Tax</span>
              <Select
                aria-label={`Tax, line ${n}`}
                className="min-h-11 xl:min-h-10"
                value={line.taxRateId ?? ""}
                onChange={(e) => update(line.key, { taxRateId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">No tax</option>
                {taxes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1 xl:items-end">
              <span className={FIELD_LABEL}>Amount</span>
              <span className="flex min-h-11 items-center font-medium tabular-nums xl:min-h-10">
                {product ? formatINR(gross) : "—"}
              </span>
            </div>

            <div className="col-span-2 flex justify-end xl:col-span-1">
              <button
                type="button"
                aria-label={`Remove line ${n}${product ? `: ${product.name}` : ""}`}
                onClick={() => remove(line.key)}
                className="flex size-11 items-center justify-center rounded-md text-xl leading-none text-muted hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary xl:size-9"
              >
                <span aria-hidden>×</span>
              </button>
            </div>
          </div>
        );
      })}

      <div className="px-4 py-3">
        <button
          ref={addRef}
          type="button"
          onClick={add}
          className={`${buttonClasses("ghost", "sm")} -ml-3 min-h-11 text-primary xl:min-h-8`}
        >
          + Add a line
        </button>
        {error && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

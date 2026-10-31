"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select, postJson } from "@/components";
import { formatINR } from "@/lib/money";
import { priceInvoice } from "@/lib/pricing";
import type { SubscriptionOptions } from "../queries";

type Line = { key: number; productId: string; variantOptionId: string; quantity: string; taxRateId: string };
const emptyLine = (key: number): Line => ({ key, productId: "", variantOptionId: "", quantity: "1", taxRateId: "" });

export function SubscriptionForm({ options, today }: { options: SubscriptionOptions; today: string }) {
  const router = useRouter();
  const nextKey = useRef(2);
  const [customerId, setCustomer] = useState("");
  const [planId, setPlan] = useState("");
  const [templateId, setTemplate] = useState("");
  const [startDate, setStart] = useState(today);
  const [endDate, setEnd] = useState("");
  const [term, setTerm] = useState("15");
  const [lines, setLines] = useState<Line[]>([emptyLine(1)]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const plan = options.plans.find((item) => item.id === Number(planId));

  function update(key: number, changes: Partial<Line>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...changes } : line));
  }
  function applyTemplate(value: string) {
    setTemplate(value);
    const template = options.templates.find((item) => item.id === Number(value));
    if (!template) return;
    setPlan(String(template.planId));
    setLines(template.lines.map((line) => ({ key: nextKey.current++, productId: String(line.productId), variantOptionId: line.variantOptionId ? String(line.variantOptionId) : "", quantity: String(line.quantity), taxRateId: "" })));
  }

  const priced = priceInvoice(lines.map((line) => {
    const product = options.products.find((item) => item.id === Number(line.productId));
    const variant = product?.variants.find((item) => item.id === Number(line.variantOptionId));
    const quantity = Number(line.quantity);
    return { description: product?.name || "", productId: product?.id || 0, quantity: Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0,
      unitPrice: (product?.salesPrice || 0) + (variant?.extraPrice || 0), taxBps: options.taxes.find((tax) => tax.id === Number(line.taxRateId))?.rateBps || 0 };
  }), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    // Native date inputs may commit change on blur. Submit their visible values even on Enter.
    const dates = new FormData(event.currentTarget);
    const submittedStart = String(dates.get("startDate") || "");
    const submittedEnd = String(dates.get("endDate") || "");
    if (!lines.length || lines.some((line) => !options.products.some((product) => product.id === Number(line.productId)) || !Number.isSafeInteger(Number(line.quantity)) || Number(line.quantity) < 1)) {
      setError("Add at least one available product with a whole-number quantity of 1 or more."); return;
    }
    if (!plan || !options.customers.some((customer) => customer.id === Number(customerId))) { setError("Choose a customer and an available plan."); return; }
    if (lines.reduce((sum, line) => sum + Number(line.quantity), 0) < plan.minQuantity) { setError(`This plan requires a total quantity of at least ${plan.minQuantity}.`); return; }
    if (submittedEnd && submittedEnd <= submittedStart) { setError("End date must be after the start date."); return; }
    if (!Number.isSafeInteger(priced.total)) { setError("The subscription amount is too large. Reduce the quantity."); return; }
    setBusy(true);
    const result = await postJson<{ id: number }>("/api/subscriptions", {
      customerId: Number(customerId), planId: Number(planId), templateId: templateId ? Number(templateId) : null,
      startDate: submittedStart, endDate: submittedEnd || null, paymentTermDays: Number(term),
      lines: lines.map((line) => ({ productId: Number(line.productId), variantOptionId: line.variantOptionId ? Number(line.variantOptionId) : null, quantity: Number(line.quantity), taxRateId: line.taxRateId ? Number(line.taxRateId) : null })),
    });
    if (!result.ok) { setBusy(false); setError(result.error); return; }
    router.push(`/subscriptions/${result.data.id}`); router.refresh();
  }

  if (!options.customers.length || !options.plans.length || !options.products.length) return <div className="rounded-xl border border-line bg-surface p-8 text-sm"><h2 className="mb-2 font-semibold">A little setup comes first</h2><p className="mb-5 text-muted">A customer, an active plan and an active product are needed before creating a subscription.</p><Button href="/subscriptions">Back to subscriptions</Button></div>;

  return <form onSubmit={submit} aria-busy={busy}>
    <fieldset disabled={busy} className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6"><section className="rounded-xl border border-line bg-surface p-5 md:p-6"><h2 className="mb-6 font-semibold">Customer &amp; billing</h2><div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField label="Customer" required>{(field) => <Select {...field} required value={customerId} onChange={(event) => setCustomer(event.target.value)}><option value="">Select a customer</option>{options.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.email}</option>)}</Select>}</FormField>
        <FormField label="Quotation template" hint="Optional. Selecting a template fills its plan and product lines.">{(field) => <Select {...field} value={templateId} onChange={(event) => applyTemplate(event.target.value)}><option value="">Start from scratch</option>{options.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select>}</FormField>
        <FormField label="Recurring plan" required hint={plan ? `Billed every ${plan.periodCount} ${plan.periodUnit.toLowerCase()}${plan.periodCount > 1 ? "s" : ""}. Minimum quantity: ${plan.minQuantity}.` : undefined}>{(field) => <Select {...field} required value={planId} onChange={(event) => { setPlan(event.target.value); setTemplate(""); }}><option value="">Choose a plan</option>{options.plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>}</FormField>
        <FormField label="Payment terms (days)" required>{(field) => <Input {...field} required type="number" min={0} max={365} step={1} value={term} onChange={(event) => setTerm(event.target.value)} />}</FormField>
        <FormField label="Start date" required>{(field) => <Input {...field} required name="startDate" type="date" value={startDate} onInput={(event) => setStart(event.currentTarget.value)} onChange={(event) => setStart(event.target.value)} />}</FormField>
        <FormField label="End date" hint="Leave empty for an ongoing subscription.">{(field) => <Input {...field} name="endDate" type="date" min={startDate} value={endDate} onInput={(event) => setEnd(event.currentTarget.value)} onChange={(event) => setEnd(event.target.value)} />}</FormField>
      </div></section>
      <section className="rounded-xl border border-line bg-surface"><div className="flex items-center justify-between border-b border-line p-5"><h2 className="font-semibold">Subscription lines</h2><Button size="sm" onClick={() => setLines((current) => [...current, emptyLine(nextKey.current++)])}>Add product</Button></div>
        <div className="divide-y divide-line">{lines.map((line, index) => {
          const product = options.products.find((item) => item.id === Number(line.productId));
          return <div key={line.key} className="space-y-4 p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-muted">Product {index + 1}</p><Button size="sm" variant="ghost" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>Remove</Button></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><FormField label="Product" required>{(field) => <Select {...field} required value={line.productId} onChange={(event) => update(line.key, { productId: event.target.value, variantOptionId: "" })}><option value="">Choose a product</option>{options.products.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatINR(item.salesPrice)}</option>)}</Select>}</FormField>
            <FormField label="Variant">{(field) => <Select {...field} value={line.variantOptionId} disabled={!product?.variants.length} onChange={(event) => update(line.key, { variantOptionId: event.target.value })}><option value="">Standard</option>{product?.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.attribute}: {variant.value} (+{formatINR(variant.extraPrice)})</option>)}</Select>}</FormField>
            <FormField label="Quantity" required>{(field) => <Input {...field} required type="number" min={1} step={1} value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} />}</FormField>
            <FormField label="Tax">{(field) => <Select {...field} value={line.taxRateId} onChange={(event) => update(line.key, { taxRateId: event.target.value })}><option value="">No tax</option>{options.taxes.map((tax) => <option key={tax.id} value={tax.id}>{tax.name} ({tax.rateBps / 100}%)</option>)}</Select>}</FormField></div>
            <p className="text-right text-sm font-medium tabular-nums">Line estimate: {formatINR(priced.lines[index].net + priced.lines[index].taxAmount)}</p>
          </div>;
        })}</div>
      </section></div>
      <aside className="rounded-xl border border-line bg-surface p-5 xl:sticky xl:top-6"><h2 className="font-semibold">Recurring estimate</h2><p className="mb-6 mt-2 text-sm text-muted">Per billing period, based on your selected products.</p><dl className="space-y-3 text-sm"><div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatINR(priced.subtotal)}</dd></div><div className="flex justify-between"><dt className="text-muted">Tax</dt><dd className="tabular-nums">{formatINR(priced.taxTotal)}</dd></div><div className="flex justify-between border-t border-line pt-4 text-base font-semibold"><dt>Estimated total</dt><dd className="tabular-nums">{formatINR(priced.total)}</dd></div></dl><p className="my-5 text-xs leading-relaxed text-muted">Eligible discounts are applied when invoices are generated. This estimate does not include discounts.</p>
        {error && <p role="alert" className="mb-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" loading={busy} className="w-full">Create draft subscription</Button><div className="mt-3"><Button variant="ghost" className="w-full" onClick={() => router.push("/subscriptions")}>Cancel</Button></div>
      </aside>
    </fieldset>
  </form>;
}

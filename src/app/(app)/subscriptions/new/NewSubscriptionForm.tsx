"use client";
// Create a draft subscription. Validation mirrors createSubscriptionSchema; the server has the final say.
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, FormField, Input, Select, postJson, useToast } from "@/components";
import { CustomerPicker, type CustomerOption } from "../CustomerPicker";
import { LineEditor, newLine } from "../LineEditor";
import { Totals } from "../Totals";
import { planOptionLabel } from "../labels";
import { orderTotals, parseServerError, unitPriceFor, validateDraft, type FormErrors } from "../logic";
import type { CatalogPlan, CatalogProduct, CatalogTax, CatalogTemplate, EditorLine } from "../types";

interface Props {
  plans: CatalogPlan[];
  products: CatalogProduct[];
  taxes: CatalogTax[];
  templates: CatalogTemplate[];
  defaultStart: string;
}

const CARD = "rounded-lg border border-line bg-surface";

export function NewSubscriptionForm({ plans, products, taxes, templates, defaultStart }: Props) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const defaultTaxId = taxes[0]?.id ?? null;

  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState("");
  const [terms, setTerms] = useState("15");
  const [lines, setLines] = useState<EditorLine[]>(() => [newLine(defaultTaxId, { key: "l-first" })]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const productById = new Map(products.map((p) => [p.id, p]));
  const taxById = new Map(taxes.map((t) => [t.id, t]));
  const priced = lines.flatMap((l) => {
    const product = l.productId ? productById.get(l.productId) : undefined;
    if (!product || !Number.isInteger(l.quantity) || l.quantity < 1) return [];
    const variant = product.variants.find((v) => v.id === l.variantOptionId);
    return [
      {
        productId: product.id,
        quantity: l.quantity,
        unitPrice: unitPriceFor(product.salesPrice, variant?.extraPrice ?? 0),
        taxBps: l.taxRateId ? (taxById.get(l.taxRateId)?.rateBps ?? 0) : 0,
      },
    ];
  });
  const totals = orderTotals(priced);

  function clear(field: keyof FormErrors) {
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  }

  function applyTemplate(id: number | null) {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setPlanId(template.planId);
    setLines(
      template.lines.map((l) =>
        newLine(defaultTaxId, { productId: l.productId, variantOptionId: l.variantOptionId, quantity: l.quantity }),
      ),
    );
    setErrors({});
    toast.show(`Lines filled from "${template.name}"`);
  }

  function focusFirstError(found: FormErrors) {
    const order: (keyof FormErrors)[] = ["customerId", "planId", "startDate", "endDate", "paymentTermDays", "lines"];
    const first = order.find((k) => found[k]);
    const target = first ? formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"] :is(input,select,textarea)`) : null;
    target?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const found = validateDraft(
      { customerId: customer?.id ?? null, planId, startDate, endDate, paymentTermDays: terms, lines },
      plan,
    );
    setErrors(found);
    setGeneral(null);
    if (Object.keys(found).length > 0) {
      toast.error("Fix the highlighted fields and try again");
      focusFirstError(found);
      return;
    }
    setSubmitting(true);
    const result = await postJson<{ id: number; number: string }>("/api/subscriptions", {
      customerId: customer?.id,
      planId,
      templateId,
      startDate,
      endDate: endDate || undefined,
      paymentTermDays: Number(terms),
      lines: lines.map((l) => ({
        productId: l.productId,
        variantOptionId: l.variantOptionId,
        quantity: l.quantity,
        taxRateId: l.taxRateId,
      })),
    });
    if (!result.ok) {
      const parsed = parseServerError(result.error);
      setErrors(parsed.fields);
      setGeneral(parsed.general ?? (Object.keys(parsed.fields).length === 0 ? result.error : null));
      toast.error(result.error);
      setSubmitting(false);
      return;
    }
    toast.success(`${result.data.number} created as a draft`);
    router.push(`/subscriptions/${result.data.id}`);
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) formRef.current?.requestSubmit();
      }}
      className="flex flex-col gap-6 p-4 md:p-6"
    >
      {general && (
        <p role="alert" className="rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
          {general}
        </p>
      )}

      <section className={CARD} aria-labelledby="details-h">
        <h2 id="details-h" className="border-b border-line px-4 py-3 text-sm font-semibold">Subscription details</h2>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div data-field="customerId">
            <FormField label="Customer" required error={errors.customerId}>
              {(f) => (
                <CustomerPicker
                  id={f.id}
                  invalid={f.invalid}
                  aria-describedby={f["aria-describedby"]}
                  value={customer}
                  onChange={(c) => {
                    setCustomer(c);
                    clear("customerId");
                  }}
                />
              )}
            </FormField>
          </div>

          <div data-field="planId">
            <FormField label="Plan" required error={errors.planId}>
              {(f) => (
                <Select
                  {...f}
                  className="min-h-11 md:min-h-10"
                  value={planId ?? ""}
                  onChange={(e) => {
                    setPlanId(e.target.value ? Number(e.target.value) : null);
                    clear("planId");
                    clear("lines");
                  }}
                >
                  <option value="">Choose a plan…</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {planOptionLabel(p)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          <FormField label="Quotation template" hint="Optional. Choosing one fills the plan and the lines.">
            {(f) => (
              <Select
                {...f}
                className="min-h-11 md:min-h-10"
                value={templateId ?? ""}
                onChange={(e) => applyTemplate(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">No template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <div data-field="paymentTermDays">
            <FormField label="Payment terms (days)" required error={errors.paymentTermDays} hint="Days after the invoice date.">
              {(f) => (
                <Input
                  {...f}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={365}
                  className="min-h-11 md:min-h-10"
                  value={terms}
                  onChange={(e) => {
                    setTerms(e.target.value);
                    clear("paymentTermDays");
                  }}
                />
              )}
            </FormField>
          </div>

          <div data-field="startDate">
            <FormField label="Start date" required error={errors.startDate}>
              {(f) => (
                <Input
                  {...f}
                  type="date"
                  className="min-h-11 md:min-h-10"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    clear("startDate");
                    clear("endDate");
                  }}
                />
              )}
            </FormField>
          </div>

          <div data-field="endDate">
            <FormField label="Expiry date" error={errors.endDate} hint="Optional. Leave empty for no end.">
              {(f) => (
                <Input
                  {...f}
                  type="date"
                  className="min-h-11 md:min-h-10"
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    clear("endDate");
                  }}
                />
              )}
            </FormField>
          </div>
        </div>
        {plan && plan.minQuantity > 1 && (
          <p className="border-t border-line px-4 py-2 text-xs text-muted">
            This plan needs a total quantity of at least {plan.minQuantity}.
          </p>
        )}
      </section>

      <section className={CARD} data-field="lines" aria-labelledby="lines-h">
        <h2 id="lines-h" className="border-b border-line px-4 py-3 text-sm font-semibold">Order lines</h2>
        <LineEditor
          lines={lines}
          products={products}
          taxes={taxes}
          defaultTaxId={defaultTaxId}
          error={errors.lines}
          onChange={(next) => {
            setLines(next);
            clear("lines");
          }}
        />
        <Totals {...totals} note="List price. Discounts are applied when each invoice is generated." />
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-xs text-muted sm:mr-auto">Tip: Enter in a quantity adds a line. Ctrl+Enter saves.</p>
        <Button href="/subscriptions" className="min-h-11 md:min-h-10">Cancel</Button>
        <Button type="submit" variant="primary" loading={submitting} className="min-h-11 md:min-h-10">
          Create subscription
        </Button>
      </div>
    </form>
  );
}

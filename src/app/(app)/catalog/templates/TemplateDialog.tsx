"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Button, Dialog, FormField, Input, Select, useToast } from "@/components";
import { apiFetch } from "../client-api";
import { initialTemplateLines, type TemplateLineDraft } from "./lines";

type TemplateView = Prisma.QuoteTemplateGetPayload<{
  include: { plan: { select: { id: true; name: true } }; lines: true };
}>;

interface PlanOption {
  id: number;
  name: string;
}

interface ProductOption {
  id: number;
  name: string;
  variants: { id: number; attribute: string; value: string }[];
}

export function TemplateDialog({
  open,
  onClose,
  template,
  plans,
  products,
  canWrite = true,
}: {
  open: boolean;
  onClose: () => void;
  template: TemplateView | null;
  plans: PlanOption[];
  products: ProductOption[];
  canWrite?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = Boolean(template);
  const formId = `template-form-${template?.id ?? "new"}`;

  const [lines, setLines] = useState<TemplateLineDraft[]>(() => initialTemplateLines(template, products));

  function addLine() {
    if (products.length === 0) return;
    setLines([...lines, { productId: products[0].id, quantity: 1 }]);
  }

  function updateLine(index: number, updates: Partial<TemplateLineDraft>) {
    const next = [...lines];
    next[index] = { ...next[index], ...updates };
    setLines(next);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) {
      setErrors({ lines: "A template requires at least one product line" });
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const planId = Number(form.get("planId"));
    const validityDays = Number(form.get("validityDays") ?? 30);

    const next: Record<string, string> = {};
    if (!name) next.name = "Template name is required";
    if (!planId) next.planId = "Select a plan";
    if (lines.length === 0) next.lines = "Add at least one product line";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const payload = {
      name,
      planId,
      validityDays,
      lines: lines.map((l) => ({
        productId: l.productId,
        variantOptionId: l.variantOptionId || null,
        quantity: Math.max(1, l.quantity || 1),
      })),
    };

    const res = isEdit
      ? await apiFetch(`/api/templates/${template!.id}`, { method: "PATCH", body: payload })
      : await apiFetch("/api/templates", { method: "POST", body: payload });
    setSaving(false);

    if (!res.ok) {
      setErrors({ form: res.error });
      return;
    }
    toast.success(isEdit ? "Template updated" : "Template created");
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Template: ${template?.name}` : "New Quotation Template"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {canWrite && (
            <Button type="submit" form={formId} variant="primary" loading={saving}>
              {isEdit ? "Save changes" : "Create template"}
            </Button>
          )}
        </>
      }
    >
      <form id={formId} key={String(open) + (template?.id ?? "new")} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {errors.form && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.form}
          </p>
        )}
        <FormField label="Template name" required error={errors.name}>
          {(f) => <Input {...f} name="name" defaultValue={template?.name ?? ""} disabled={!canWrite} />}
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Plan" required error={errors.planId}>
            {(f) => (
              <Select {...f} name="planId" defaultValue={template?.planId ?? plans[0]?.id} disabled={!canWrite}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Validity in days">
            {(f) => (
              <Input
                {...f}
                name="validityDays"
                type="number"
                min="1"
                max="365"
                defaultValue={template?.validityDays ?? 30}
                disabled={!canWrite}
              />
            )}
          </FormField>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Product lines</span>
            {canWrite && (
              <Button type="button" size="sm" onClick={addLine}>
                + Add line
              </Button>
            )}
          </div>
          {errors.lines && <p className="text-xs text-danger">{errors.lines}</p>}
          <div className="rounded-md border border-line divide-y divide-line">
            {lines.map((line, idx) => {
              const selectedProduct = products.find((p) => p.id === line.productId);
              return (
                <div key={idx} className="p-3 flex flex-col sm:flex-row gap-2 items-center">
                  <select
                    aria-label={`Product for line ${idx + 1}`}
                    className="w-full sm:w-1/2 h-9 rounded-md border border-line bg-surface px-2 text-sm"
                    value={line.productId}
                    disabled={!canWrite}
                    onChange={(e) => updateLine(idx, { productId: Number(e.target.value), variantOptionId: null })}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  {selectedProduct && selectedProduct.variants.length > 0 ? (
                    <select
                      aria-label={`Variant for line ${idx + 1}`}
                      className="w-full sm:w-1/3 h-9 rounded-md border border-line bg-surface px-2 text-sm"
                      value={line.variantOptionId ?? ""}
                      disabled={!canWrite}
                      onChange={(e) => updateLine(idx, { variantOptionId: Number(e.target.value) || null })}
                    >
                      <option value="">Base variant</option>
                      {selectedProduct.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.attribute}: {v.value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="w-full sm:w-1/3 text-xs text-muted">No variants</span>
                  )}

                  <input
                    type="number"
                    aria-label={`Quantity for line ${idx + 1}`}
                    min="1"
                    className="w-20 h-9 rounded-md border border-line bg-surface px-2 text-sm"
                    value={line.quantity}
                    disabled={!canWrite}
                    onChange={(e) => updateLine(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                  />

                  {canWrite && lines.length > 1 && (
                    <Button type="button" size="sm" variant="danger" aria-label={`Remove line ${idx + 1}`} onClick={() => removeLine(idx)}>
                      ×
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </form>
    </Dialog>
  );
}

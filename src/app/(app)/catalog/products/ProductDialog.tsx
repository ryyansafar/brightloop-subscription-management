"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Button, Dialog, FormField, Input, Select, Textarea, useToast } from "@/components";
import { apiFetch } from "../client-api";
import { parseRupeesToPaise, toRupeesInput } from "../helpers";

type ProductWithVariants = Prisma.ProductGetPayload<{ include: { variants: true } }>;

export function ProductDialog({
  open,
  onClose,
  product,
  canWrite = true,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductWithVariants | null;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formId = `product-form-${product?.id ?? "new"}`;
  const isEdit = Boolean(product);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const type = String(form.get("type") ?? "");
    const salesPriceStr = String(form.get("salesPrice") ?? "");
    const costPriceStr = String(form.get("costPrice") ?? "");
    const notes = String(form.get("notes") ?? "").trim() || null;
    const active = form.get("active") === "true";

    const next: Record<string, string> = {};
    if (!name) next.name = "Name is required";
    const salesPrice = parseRupeesToPaise(salesPriceStr);
    if (salesPrice === null) next.salesPrice = "Enter a valid positive sales price (e.g. 1500 or 1500.50)";
    const costPrice = costPriceStr ? parseRupeesToPaise(costPriceStr) : 0;
    if (costPrice === null) next.costPrice = "Enter a valid positive cost price";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const payload = { name, type, salesPrice, costPrice: costPrice ?? 0, notes, active };
    const res = isEdit
      ? await apiFetch(`/api/products/${product!.id}`, { method: "PATCH", body: payload })
      : await apiFetch("/api/products", { method: "POST", body: payload });
    setSaving(false);

    if (!res.ok) {
      setErrors({ form: res.error });
      return;
    }
    toast.success(isEdit ? "Product updated" : "Product created");
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Product: ${product?.name}` : "New Product"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {canWrite && (
            <Button type="submit" form={formId} variant="primary" loading={saving}>
              {isEdit ? "Save changes" : "Create product"}
            </Button>
          )}
        </>
      }
    >
      <form id={formId} key={String(open) + (product?.id ?? "new")} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {errors.form && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.form}
          </p>
        )}
        <FormField label="Product name" required error={errors.name}>
          {(f) => <Input {...f} name="name" defaultValue={product?.name ?? ""} disabled={!canWrite} />}
        </FormField>
        <FormField label="Product type" required>
          {(f) => (
            <Select {...f} name="type" defaultValue={product?.type ?? "SOFTWARE"} disabled={!canWrite}>
              <option value="SOFTWARE">Software</option>
              <option value="SERVICE">Service</option>
              <option value="ADDON">Addon</option>
            </Select>
          )}
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Sales price (₹)" required error={errors.salesPrice}>
            {(f) => (
              <Input
                {...f}
                name="salesPrice"
                inputMode="decimal"
                defaultValue={product ? toRupeesInput(product.salesPrice) : ""}
                placeholder="0.00"
                disabled={!canWrite}
              />
            )}
          </FormField>
          <FormField label="Cost price (₹)" error={errors.costPrice}>
            {(f) => (
              <Input
                {...f}
                name="costPrice"
                inputMode="decimal"
                defaultValue={product ? toRupeesInput(product.costPrice) : "0.00"}
                placeholder="0.00"
                disabled={!canWrite}
              />
            )}
          </FormField>
        </div>
        <FormField label="Status">
          {(f) => (
            <Select {...f} name="active" defaultValue={product?.active !== false ? "true" : "false"} disabled={!canWrite}>
              <option value="true">Active</option>
              <option value="false">Archived</option>
            </Select>
          )}
        </FormField>
        <FormField label="Notes" hint="Optional internal notes">
          {(f) => <Textarea {...f} name="notes" defaultValue={product?.notes ?? ""} rows={2} disabled={!canWrite} />}
        </FormField>
      </form>
    </Dialog>
  );
}

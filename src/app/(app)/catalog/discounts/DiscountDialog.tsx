"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Button, Dialog, FormField, Input, Select, useToast } from "@/components";
import { apiFetch } from "../client-api";
import { parsePercentToBps, parseRupeesToPaise, toDateInputValue, toPercentInput, toRupeesInput } from "../helpers";

type DiscountWithProduct = Prisma.DiscountGetPayload<{ include: { product: { select: { id: true; name: true } } } }>;

interface ProductOption {
  id: number;
  name: string;
}

export function DiscountDialog({
  open,
  onClose,
  discount,
  products,
}: {
  open: boolean;
  onClose: () => void;
  discount: DiscountWithProduct | null;
  products: ProductOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  // lazy initialiser keeps the clock read out of render (react-hooks/purity)
  const [today] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = Boolean(discount);
  const formId = `discount-form-${discount?.id ?? "new"}`;

  const [kind, setKind] = useState<"FIXED" | "PERCENT">(discount?.kind === "PERCENT" ? "PERCENT" : "FIXED");
  const [scope, setScope] = useState<"SUBSCRIPTION" | "PRODUCT">(discount?.scope === "PRODUCT" ? "PRODUCT" : "SUBSCRIPTION");

  // Reset the form whenever the dialog opens or its subject changes (compare during render, no effect).
  const [seen, setSeen] = useState({ open, discount });
  if (seen.open !== open || seen.discount !== discount) {
    setSeen({ open, discount });
    if (open) {
      setKind(discount?.kind === "PERCENT" ? "PERCENT" : "FIXED");
      setScope(discount?.scope === "PRODUCT" ? "PRODUCT" : "SUBSCRIPTION");
      setErrors({});
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const valueRaw = form.get("value") as string;
    const value = kind === "PERCENT" ? parsePercentToBps(valueRaw) : parseRupeesToPaise(valueRaw);
    const minAmountRaw = String(form.get("minAmount") ?? "").trim();
    const minAmount = minAmountRaw ? parseRupeesToPaise(minAmountRaw) : 0;
    const minQuantityRaw = String(form.get("minQuantity") ?? "").trim();
    const minQuantity = minQuantityRaw ? Number(minQuantityRaw) : 0;
    const startsAtStr = form.get("startsAt") as string;
    const endsAtStr = form.get("endsAt") as string;
    const usageLimitStr = form.get("usageLimit") as string;
    const usageLimit = usageLimitStr ? Number(usageLimitStr) : null;
    const productId = scope === "PRODUCT" ? Number(form.get("productId")) : null;
    const active = form.get("active") === "true";

    const next: Record<string, string> = {};
    if (!name) next.name = "Discount name is required";
    if (value === null || value <= 0) {
      next.value = kind === "PERCENT" ? "Enter a valid percentage (1-100%)" : "Enter a valid rupee discount greater than 0";
    }
    if (minAmount === null) {
      next.minAmount = "Enter a valid minimum purchase amount (cannot be negative)";
    }
    if (Number.isNaN(minQuantity) || minQuantity < 0 || !Number.isInteger(minQuantity)) {
      next.minQuantity = "Minimum quantity cannot be negative";
    }
    if (!startsAtStr) next.startsAt = "Start date is required";
    if (!endsAtStr) next.endsAt = "End date is required";
    if (startsAtStr && endsAtStr && endsAtStr <= startsAtStr) {
      next.endsAt = "End date must be after the start date";
    }
    if (scope === "PRODUCT" && (!productId || productId <= 0)) {
      next.productId = "Select a product for product-scoped discount";
    }
    if (usageLimit !== null && (usageLimit < 1 || !Number.isInteger(usageLimit))) {
      next.usageLimit = "Usage limit must be at least 1 (or leave blank for unlimited)";
    } else if (isEdit && usageLimit !== null && usageLimit < discount!.usedCount) {
      next.usageLimit = `Limit cannot be less than existing ${discount!.usedCount} uses`;
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const payload = {
      name,
      kind,
      value,
      minAmount,
      minQuantity,
      startsAt: new Date(startsAtStr).toISOString(),
      endsAt: new Date(endsAtStr).toISOString(),
      usageLimit,
      scope,
      productId: scope === "PRODUCT" ? productId : null,
      active,
    };

    const res = isEdit
      ? await apiFetch(`/api/discounts/${discount!.id}`, { method: "PATCH", body: payload })
      : await apiFetch("/api/discounts", { method: "POST", body: payload });
    setSaving(false);

    if (!res.ok) {
      setErrors({ form: res.error });
      return;
    }
    toast.success(isEdit ? "Discount updated" : "Discount created");
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Discount: ${discount?.name}` : "New Discount Rule"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={saving}>
            {isEdit ? "Save changes" : "Create discount"}
          </Button>
        </>
      }
    >
      <form id={formId} key={String(open) + (discount?.id ?? "new")} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {errors.form && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.form}
          </p>
        )}
        <FormField label="Discount name" required error={errors.name}>
          {(f) => <Input {...f} name="name" defaultValue={discount?.name ?? ""} placeholder="e.g. Black Friday 20%" />}
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Kind">
            {(f) => (
              <Select {...f} name="kind" value={kind} onChange={(e) => setKind(e.target.value as "FIXED" | "PERCENT")}>
                <option value="PERCENT">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₹)</option>
              </Select>
            )}
          </FormField>
          <FormField
            label={kind === "PERCENT" ? "Discount percentage (%)" : "Discount amount (₹)"}
            hint={kind === "PERCENT" ? "Percent, e.g. 10 for 10%" : "Amount in ₹, e.g. 100"}
            required
            error={errors.value}
          >
            {(f) => (
              <Input
                {...f}
                key={kind}
                name="value"
                inputMode="decimal"
                defaultValue={discount ? (kind === "PERCENT" ? toPercentInput(discount.value) : toRupeesInput(discount.value)) : ""}
                placeholder={kind === "PERCENT" ? "10" : "500.00"}
              />
            )}
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Scope">
            {(f) => (
              <Select {...f} name="scope" value={scope} onChange={(e) => setScope(e.target.value as "SUBSCRIPTION" | "PRODUCT")}>
                <option value="SUBSCRIPTION">Whole Subscription</option>
                <option value="PRODUCT">Specific Product</option>
              </Select>
            )}
          </FormField>
          {scope === "PRODUCT" && (
            <FormField label="Target Product" required error={errors.productId}>
              {(f) => (
                <Select {...f} name="productId" defaultValue={discount?.productId ?? products[0]?.id}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Min purchase amount (₹)" hint="Minimum subscription total" error={errors.minAmount}>
            {(f) => (
              <Input
                {...f}
                name="minAmount"
                inputMode="decimal"
                defaultValue={discount ? toRupeesInput(discount.minAmount) : "0"}
                placeholder="0.00"
              />
            )}
          </FormField>
          <FormField label="Min quantity" hint="Minimum items required" error={errors.minQuantity}>
            {(f) => (
              <Input
                {...f}
                name="minQuantity"
                type="number"
                min="0"
                defaultValue={discount?.minQuantity ?? 0}
              />
            )}
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Start date" required error={errors.startsAt}>
            {(f) => (
              <Input
                {...f}
                name="startsAt"
                type="date"
                defaultValue={toDateInputValue(discount?.startsAt ?? today)}
              />
            )}
          </FormField>
          <FormField label="End date" required error={errors.endsAt}>
            {(f) => (
              <Input
                {...f}
                name="endsAt"
                type="date"
                defaultValue={toDateInputValue(discount?.endsAt ?? new Date(today.getTime() + 30 * 86400000))}
              />
            )}
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Usage limit" hint="Leave blank for unlimited" error={errors.usageLimit}>
            {(f) => (
              <Input
                {...f}
                name="usageLimit"
                type="number"
                min={isEdit ? discount?.usedCount ?? 1 : 1}
                defaultValue={discount?.usageLimit ?? ""}
                placeholder="Unlimited"
              />
            )}
          </FormField>
          <FormField label="Status">
            {(f) => (
              <Select {...f} name="active" defaultValue={discount?.active !== false ? "true" : "false"}>
                <option value="true">Active</option>
                <option value="false">Archived</option>
              </Select>
            )}
          </FormField>
        </div>
        {isEdit && (
          <p className="text-xs text-muted">
            Used count: <strong className="text-foreground">{discount?.usedCount}</strong> uses recorded by billing engine.
          </p>
        )}
      </form>
    </Dialog>
  );
}

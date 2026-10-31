"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@prisma/client";
import { Button, Dialog, FormField, Input, Select, useToast } from "@/components";
import { apiFetch } from "../client-api";
import { parseRupeesToPaise, toDateInputValue, toRupeesInput } from "../helpers";

export function PlanDialog({
  open,
  onClose,
  plan,
  canWrite = true,
}: {
  open: boolean;
  onClose: () => void;
  plan: Plan | null;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = Boolean(plan);
  const formId = `plan-form-${plan?.id ?? "new"}`;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const price = parseRupeesToPaise(form.get("price") as string);
    const periodUnit = String(form.get("periodUnit") ?? "MONTH");
    const periodCount = Number(form.get("periodCount") ?? 1);
    const minQuantity = Number(form.get("minQuantity") ?? 1);
    const availableFromStr = form.get("availableFrom") as string;
    const availableToStr = form.get("availableTo") as string;
    const autoClose = form.get("autoClose") === "on";
    const closable = form.get("closable") === "on";
    const pausable = form.get("pausable") === "on";
    const renewable = form.get("renewable") === "on";
    const active = form.get("active") === "true";

    const next: Record<string, string> = {};
    if (!name) next.name = "Name is required";
    if (price === null) next.price = "Enter a valid positive price in rupees";
    if (availableFromStr && availableToStr && availableToStr < availableFromStr) {
      next.availableTo = "Available-to date cannot be before available-from";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const payload = {
      name,
      price,
      periodUnit,
      periodCount,
      minQuantity,
      availableFrom: availableFromStr ? new Date(availableFromStr).toISOString() : null,
      availableTo: availableToStr ? new Date(availableToStr).toISOString() : null,
      autoClose,
      closable,
      pausable,
      renewable,
      active,
    };

    const res = isEdit
      ? await apiFetch(`/api/plans/${plan!.id}`, { method: "PATCH", body: payload })
      : await apiFetch("/api/plans", { method: "POST", body: payload });
    setSaving(false);

    if (!res.ok) {
      setErrors({ form: res.error });
      return;
    }
    toast.success(isEdit ? "Plan updated" : "Plan created");
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Plan: ${plan?.name}` : "New Subscription Plan"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {canWrite && (
            <Button type="submit" form={formId} variant="primary" loading={saving}>
              {isEdit ? "Save changes" : "Create plan"}
            </Button>
          )}
        </>
      }
    >
      <form id={formId} key={String(open) + (plan?.id ?? "new")} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {errors.form && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.form}
          </p>
        )}
        <FormField label="Plan name" required error={errors.name}>
          {(f) => <Input {...f} name="name" defaultValue={plan?.name ?? ""} disabled={!canWrite} />}
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Price (₹)" required error={errors.price}>
            {(f) => (
              <Input
                {...f}
                name="price"
                inputMode="decimal"
                defaultValue={plan ? toRupeesInput(plan.price) : ""}
                placeholder="0.00"
                disabled={!canWrite}
              />
            )}
          </FormField>
          <FormField label="Minimum quantity">
            {(f) => (
              <Input
                {...f}
                name="minQuantity"
                type="number"
                min="1"
                defaultValue={plan?.minQuantity ?? 1}
                disabled={!canWrite}
              />
            )}
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Billing period unit">
            {(f) => (
              <Select {...f} name="periodUnit" defaultValue={plan?.periodUnit ?? "MONTH"} disabled={!canWrite}>
                <option value="DAY">Day</option>
                <option value="WEEK">Week</option>
                <option value="MONTH">Month</option>
                <option value="YEAR">Year</option>
              </Select>
            )}
          </FormField>
          <FormField label="Period count" hint="e.g. Every 1 month or 3 months">
            {(f) => (
              <Input
                {...f}
                name="periodCount"
                type="number"
                min="1"
                max="120"
                defaultValue={plan?.periodCount ?? 1}
                disabled={!canWrite}
              />
            )}
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Available from">
            {(f) => (
              <Input
                {...f}
                name="availableFrom"
                type="date"
                defaultValue={toDateInputValue(plan?.availableFrom)}
                disabled={!canWrite}
              />
            )}
          </FormField>
          <FormField label="Available to" error={errors.availableTo}>
            {(f) => (
              <Input
                {...f}
                name="availableTo"
                type="date"
                defaultValue={toDateInputValue(plan?.availableTo)}
                disabled={!canWrite}
              />
            )}
          </FormField>
        </div>
        <div className="rounded-md border border-line p-3 bg-surface-2 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase text-muted">Plan Behavior Flags</span>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="renewable" defaultChecked={plan?.renewable ?? true} disabled={!canWrite} />
            <span>Renewable (allows renewal at end of period)</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="pausable" defaultChecked={plan?.pausable ?? true} disabled={!canWrite} />
            <span>Pausable (allows temporary hold)</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="closable" defaultChecked={plan?.closable ?? true} disabled={!canWrite} />
            <span>Closable (can be terminated)</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="autoClose" defaultChecked={plan?.autoClose ?? false} disabled={!canWrite} />
            <span>Auto-close (automatically closes at end date)</span>
          </label>
        </div>
        <FormField label="Status">
          {(f) => (
            <Select {...f} name="active" defaultValue={plan?.active !== false ? "true" : "false"} disabled={!canWrite}>
              <option value="true">Active</option>
              <option value="false">Archived</option>
            </Select>
          )}
        </FormField>
      </form>
    </Dialog>
  );
}

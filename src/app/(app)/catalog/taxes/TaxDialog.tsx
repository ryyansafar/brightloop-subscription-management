"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TaxRate } from "@prisma/client";
import { Button, Dialog, FormField, Input, Select, useToast } from "@/components";
import { apiFetch } from "../client-api";
import { parsePercentToBps, toPercentInput } from "../helpers";

export function TaxDialog({
  open,
  onClose,
  tax,
}: {
  open: boolean;
  onClose: () => void;
  tax: TaxRate | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = Boolean(tax);
  const formId = `tax-form-${tax?.id ?? "new"}`;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const rateBps = parsePercentToBps(form.get("rate") as string);
    const active = form.get("active") === "true";

    const next: Record<string, string> = {};
    if (!name) next.name = "Name is required";
    if (rateBps === null) next.rate = "Enter a valid percentage between 0% and 100% (e.g. 18 or 18.5)";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const payload = { name, rateBps, active };
    const res = isEdit
      ? await apiFetch(`/api/taxes/${tax!.id}`, { method: "PATCH", body: payload })
      : await apiFetch("/api/taxes", { method: "POST", body: payload });
    setSaving(false);

    if (!res.ok) {
      setErrors({ form: res.error });
      return;
    }
    toast.success(isEdit ? "Tax rate updated" : "Tax rate created");
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Tax Rate: ${tax?.name}` : "New Tax Rate"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={saving}>
            {isEdit ? "Save changes" : "Create tax rate"}
          </Button>
        </>
      }
    >
      <form id={formId} key={String(open) + (tax?.id ?? "new")} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {errors.form && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.form}
          </p>
        )}
        <FormField label="Tax rate name" required error={errors.name}>
          {(f) => <Input {...f} name="name" defaultValue={tax?.name ?? ""} placeholder="e.g. GST 18%" />}
        </FormField>
        <FormField label="Rate percentage (%)" required error={errors.rate} hint="Enter percentage, e.g. 18 for 18%">
          {(f) => (
            <Input
              {...f}
              name="rate"
              inputMode="decimal"
              defaultValue={tax ? toPercentInput(tax.rateBps) : ""}
              placeholder="18"
            />
          )}
        </FormField>
        <FormField label="Status">
          {(f) => (
            <Select {...f} name="active" defaultValue={tax?.active !== false ? "true" : "false"}>
              <option value="true">Active</option>
              <option value="false">Archived</option>
            </Select>
          )}
        </FormField>
      </form>
    </Dialog>
  );
}

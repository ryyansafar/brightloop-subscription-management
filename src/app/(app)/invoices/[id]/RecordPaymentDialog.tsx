"use client";
// Owner: fathima. Record a full or part payment. Amount is typed in rupees and sent as paise.
import { useState, type FormEvent } from "react";
import { Button, Dialog, FormField, Input, Select, Textarea, postJson, toDateInput } from "@/components";
import { formatINR, rupees } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/state";
import { paymentMethodLabel } from "../../payments/methods";

interface RecordPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  invoiceId: number;
  /** Shown in the title when the dialog is opened away from the invoice itself. */
  invoiceNumber?: string;
  balance: number; // paise
  onRecorded: (fullyPaid: boolean) => void;
}

/** "1,234.5" -> 123450 paise, or null if it is not a valid amount with at most 2 decimals. */
function toPaise(input: string): number | null {
  const clean = input.replaceAll(",", "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export function RecordPaymentDialog({ open, onClose, invoiceId, invoiceNumber, balance, onRecorded }: RecordPaymentDialogProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const formId = `pay-${invoiceId}`;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amount = toPaise(String(form.get("amount")));
    const paidOn = String(form.get("paidOn"));
    const next: Record<string, string> = {};
    if (amount === null || amount <= 0) next.amount = "Enter an amount greater than zero, e.g. 1500 or 1500.50";
    else if (amount > balance) next.amount = `Cannot be more than the amount due (${formatINR(balance)})`;
    if (!paidOn) next.paidOn = "Pick the date the payment was received";
    else if (paidOn > toDateInput(new Date())) next.paidOn = "The payment date cannot be in the future";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const result = await postJson<{ invoiceStatus: string }>("/api/payments", {
      invoiceId,
      amount,
      method: form.get("method"),
      paidOn,
      note: String(form.get("note") ?? "").trim() || null,
    });
    setSaving(false);
    if (!result.ok) return setErrors({ form: result.error });
    onRecorded(result.data.invoiceStatus === "PAID");
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={invoiceNumber ? `Record payment: ${invoiceNumber}` : "Record payment"}
      footer={
        <>
          <Button onClick={onClose}>Discard</Button>
          <Button type="submit" form={formId} variant="primary" loading={saving}>
            Save payment
          </Button>
        </>
      }
    >
      {/* key resets the fields each time the dialog opens */}
      <form id={formId} key={String(open)} onSubmit={submit} noValidate className="flex flex-col gap-4">
        {errors.form && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.form}
          </p>
        )}
        <FormField label="Amount (₹)" required error={errors.amount} hint={`Amount due: ${formatINR(balance)}`}>
          {(f) => <Input {...f} name="amount" inputMode="decimal" defaultValue={rupees(balance).toFixed(2)} />}
        </FormField>
        <FormField label="Payment method" required>
          {(f) => (
            <Select {...f} name="method" defaultValue="BANK_TRANSFER">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {paymentMethodLabel(m)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Payment date" required error={errors.paidOn}>
          {(f) => <Input {...f} name="paidOn" type="date" defaultValue={toDateInput(new Date())} />}
        </FormField>
        <FormField label="Note" hint="Optional, e.g. UTR or cheque number">
          {(f) => <Textarea {...f} name="note" rows={2} maxLength={500} />}
        </FormField>
      </form>
    </Dialog>
  );
}

"use client";
// Close (needs a reason) and Renew (shows the new expiry) confirmation dialogs.
import { useEffect, useRef, useState } from "react";
import { Button, Dialog, FormField, Textarea } from "@/components";

interface BaseProps {
  open: boolean;
  number: string;
  pending: boolean;
  onCancel: () => void;
}

export function CloseDialog({ open, number, pending, onCancel, onConfirm }: BaseProps & { onConfirm: (reason: string) => Promise<boolean> }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => body.current?.querySelector("textarea")?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (pending) return;
    if (!reason.trim()) return setError("Tell us why this subscription is closing");
    setError(undefined);
    if (await onConfirm(reason.trim())) setReason("");
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={`Close ${number}?`}
      footer={
        <>
          <Button className="min-h-10" onClick={onCancel} disabled={pending}>
            Keep open
          </Button>
          <Button variant="danger" className="min-h-10" loading={pending} onClick={() => void submit()}>
            Close subscription
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <p className="text-sm">Billing stops and the next invoice date is cleared. A closed subscription cannot be reopened.</p>
        <div ref={body}>
          <FormField label="Close reason" required error={error}>
            {(f) => (
              <Textarea
                {...f}
                rows={3}
                maxLength={300}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(undefined);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit();
                }}
              />
            )}
          </FormField>
        </div>
      </form>
    </Dialog>
  );
}

export function RenewDialog({ open, number, from, to, pending, onCancel, onConfirm }: BaseProps & { from: string; to: string; onConfirm: () => Promise<boolean> }) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={`Renew ${number}?`}
      footer={
        <>
          <Button className="min-h-10" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" className="min-h-10" loading={pending} onClick={() => void onConfirm()}>
            Renew
          </Button>
        </>
      }
    >
      <p className="text-sm">
        The expiry date moves from <strong>{from}</strong> to <strong>{to}</strong> (one plan period).
      </p>
    </Dialog>
  );
}

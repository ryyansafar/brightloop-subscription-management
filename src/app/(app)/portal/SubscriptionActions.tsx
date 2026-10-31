"use client";
// Renew and Close for one subscription. The API re-checks ownership and every rule; the disabled
// states here only explain what the server would refuse.
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Dialog, FormField, Textarea, formatDate, postJson, useToast } from "@/components";

interface SubscriptionActionsProps {
  id: number;
  number: string;
  planName: string;
  renewBlocked: string | null;
  closeBlocked: string | null;
}

const MAX_REASON = 300;
const TOUCH = "min-h-11 md:min-h-8";

export function SubscriptionActions({ id, number, planName, renewBlocked, closeBlocked }: SubscriptionActionsProps) {
  const router = useRouter();
  const reasonId = useId();
  const toast = useToast();
  const [renewing, setRenewing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const form = useRef<HTMLFormElement>(null);

  /** The shared Textarea has no ref prop, so the field is found by name inside this form. */
  const focusReason = () => (form.current?.elements.namedItem("reason") as HTMLElement | null)?.focus();

  useEffect(() => {
    if (open) focusReason();
  }, [open]);

  function openDialog() {
    setReason("");
    setError(undefined);
    setOpen(true);
  }

  async function renew() {
    setRenewing(true);
    const result = await postJson<{ endDate: string }>(`/api/subscriptions/${id}/renew`, {});
    setRenewing(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(`${number} renewed. It now runs until ${formatDate(result.data.endDate)}.`);
    router.refresh();
  }

  async function close() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please tell us why you are closing this subscription.");
      focusReason();
      return;
    }
    setClosing(true);
    const result = await postJson(`/api/subscriptions/${id}/transition`, { to: "CLOSED", closeReason: trimmed });
    setClosing(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    toast.success(`${number} is now closed.`);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          className={TOUCH}
          disabled={Boolean(renewBlocked)}
          loading={renewing}
          onClick={renew}
          aria-describedby={renewBlocked ? reasonId : undefined}
        >
          Renew
        </Button>
        <Button
          className={TOUCH}
          disabled={Boolean(closeBlocked)}
          onClick={openDialog}
          aria-haspopup="dialog"
          aria-describedby={closeBlocked ? reasonId : undefined}
        >
          Close
        </Button>
      </div>
      {(renewBlocked || closeBlocked) && (
        <p id={reasonId} className="mt-2 text-xs text-muted">
          {[renewBlocked && `Renew: ${renewBlocked}`, closeBlocked && `Close: ${closeBlocked}`]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Close subscription">
        <form
          ref={form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void close();
          }}
          className="flex flex-col gap-4"
        >
          <p className="text-sm">
            You are closing <strong className="break-words">{planName}</strong> ({number}). No further invoices will be
            generated after the current period. This cannot be undone from the portal.
          </p>
          <FormField label="Reason for closing" required error={error}>
            {(f) => (
              <Textarea
                {...f}
                name="reason"
                rows={3}
                maxLength={MAX_REASON}
                value={reason}
                required
                aria-required
                placeholder="Tell us why you are closing"
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(undefined);
                }}
              />
            )}
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="min-h-11 w-full sm:w-auto" onClick={() => setOpen(false)}>
              Keep subscription
            </Button>
            <Button variant="danger" type="submit" className="min-h-11 w-full sm:w-auto" loading={closing}>
              Close subscription
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

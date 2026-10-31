"use client";
// Owner: fathima. Status bar buttons. Each one calls Ryyan's API; the server re-checks every rule.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Dialog, postJson, useToast } from "@/components";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

interface InvoiceActionsProps {
  id: number;
  number: string;
  status: string;
  balance: number;
  hasPayments: boolean;
  sentAt: string | null;
}

type Action = "confirm" | "cancel" | "send";

const DONE: Record<Action, string> = {
  confirm: "Invoice confirmed",
  cancel: "Invoice cancelled",
  send: "Invoice email submitted for delivery",
};

export function InvoiceActions({ id, number, status, balance, hasPayments, sentAt }: InvoiceActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<Action | null>(null);
  const [paying, setPaying] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  async function run(action: Action) {
    setBusy(action);
    const result = await postJson<{ delivery?: string }>(`/api/invoices/${id}/${action}`);
    setBusy(null);
    setConfirmingCancel(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(action === "send" && result.data.delivery === "queued" ? "Email queued. Delivery will retry automatically while the mail worker runs." : DONE[action]);
    router.refresh();
  }

  const canCancel = (status === "DRAFT" || status === "CONFIRMED") && !hasPayments;

  return (
    <>
      {status === "DRAFT" && (
        <Button variant="primary" size="sm" loading={busy === "confirm"} onClick={() => run("confirm")}>
          Confirm
        </Button>
      )}
      {status === "CONFIRMED" && balance > 0 && (
        <Button variant="primary" size="sm" onClick={() => setPaying(true)}>
          Record payment
        </Button>
      )}
      {(status === "CONFIRMED" || status === "PAID") && (
        <Button size="sm" loading={busy === "send"} onClick={() => run("send")}>
          {sentAt ? "Send again" : "Send"}
        </Button>
      )}
      {status !== "CANCELLED" && (
        <Button size="sm" onClick={() => window.print()}>
          Print
        </Button>
      )}
      {canCancel && (
        <Button variant="danger" size="sm" onClick={() => setConfirmingCancel(true)}>
          Cancel
        </Button>
      )}

      <Dialog
        open={confirmingCancel}
        onClose={() => setConfirmingCancel(false)}
        title={`Cancel invoice ${number}?`}
        footer={
          <>
            <Button onClick={() => setConfirmingCancel(false)}>Keep invoice</Button>
            <Button variant="danger" loading={busy === "cancel"} onClick={() => run("cancel")}>
              Cancel invoice
            </Button>
          </>
        }
      >
        <p className="text-sm">
          This cannot be undone. The period stays marked as billed, so the billing run will not create it again.
        </p>
      </Dialog>

      <RecordPaymentDialog
        open={paying}
        onClose={() => setPaying(false)}
        invoiceId={id}
        balance={balance}
        onRecorded={(fullyPaid) => {
          setPaying(false);
          toast.success(fullyPaid ? "Payment recorded. Invoice is paid." : "Part payment recorded");
          router.refresh();
        }}
      />
    </>
  );
}

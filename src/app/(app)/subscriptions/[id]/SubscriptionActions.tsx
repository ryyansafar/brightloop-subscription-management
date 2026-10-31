"use client";
// Status bar buttons. Only valid actions render; each one calls the API and the server re-checks every rule.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, formatDate, postJson, useToast } from "@/components";
import { availableActions, type ActionFlags, type ActionId } from "../logic";
import { CloseDialog, RenewDialog } from "./ActionDialogs";

interface Props extends ActionFlags {
  id: number;
  number: string;
  status: string;
  /** ISO dates, only set when Renew is possible */
  endDate: string | null;
  renewTo: string | null;
}

const TRANSITIONS: Partial<Record<ActionId, { to: string; done: string }>> = {
  quote: { to: "QUOTATION", done: "Quotation sent" },
  confirm: { to: "CONFIRMED", done: "Subscription confirmed" },
  activate: { to: "ACTIVE", done: "Subscription activated" },
  pause: { to: "PAUSED", done: "Subscription paused" },
  resume: { to: "ACTIVE", done: "Subscription resumed" },
};

export function SubscriptionActions({ id, number, status, endDate, renewTo, ...flags }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<ActionId | null>(null);
  const [dialog, setDialog] = useState<"close" | "renew" | null>(null);
  const actions = availableActions(status, flags);

  async function finish(result: { ok: boolean; error?: string }, done: string) {
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return false;
    }
    setDialog(null);
    toast.success(done);
    router.refresh();
    return true;
  }

  async function run(action: ActionId, closeReason?: string) {
    setBusy(action);
    if (action === "invoice") {
      const r = await postJson<{ id: number }>("/api/invoices", { subscriptionId: id });
      return finish(r, "Invoice created");
    }
    if (action === "renew") {
      const r = await postJson(`/api/subscriptions/${id}/renew`);
      return finish(r, "Subscription renewed");
    }
    const to = action === "close" ? "CLOSED" : TRANSITIONS[action]?.to;
    if (!to) return false;
    const r = await postJson(`/api/subscriptions/${id}/transition`, { to, closeReason });
    return finish(r, action === "close" ? "Subscription closed" : (TRANSITIONS[action]?.done ?? "Done"));
  }

  const onClick = (action: ActionId) => (action === "close" || action === "renew" ? setDialog(action) : void run(action));

  return (
    <>
      {actions.map((a) => (
        <Button
          key={a.id}
          variant={a.primary ? "primary" : a.id === "close" ? "danger" : "secondary"}
          className="min-h-10 md:min-h-8"
          loading={busy === a.id}
          disabled={busy !== null}
          onClick={() => onClick(a.id)}
        >
          {a.label}
        </Button>
      ))}

      <CloseDialog
        open={dialog === "close"}
        number={number}
        pending={busy === "close"}
        onCancel={() => setDialog(null)}
        onConfirm={(reason) => run("close", reason)}
      />
      <RenewDialog
        open={dialog === "renew"}
        number={number}
        from={endDate ? formatDate(endDate) : "—"}
        to={renewTo ? formatDate(renewTo) : "—"}
        pending={busy === "renew"}
        onCancel={() => setDialog(null)}
        onConfirm={() => run("renew")}
      />
    </>
  );
}

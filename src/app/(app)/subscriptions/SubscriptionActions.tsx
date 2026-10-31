"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, FormField, Textarea, postJson, useToast } from "@/components";

export function SubscriptionActions({ id, status, plan, hasEndDate, portal = false }: {
  id: number; status: string; plan: { closable: boolean; pausable: boolean; renewable: boolean }; hasEndDate: boolean; portal?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const disabled = !!busy || refreshing;

  async function run(action: string, body?: unknown) {
    if (disabled) return;
    setBusy(action);
    const result = await postJson<{ id: number }>(action === "invoice" ? "/api/invoices" : `/api/subscriptions/${id}/${action === "renew" ? "renew" : "transition"}`, action === "invoice" ? { subscriptionId: id } : body);
    setBusy(null);
    if (!result.ok) { toast.error(result.error); return; }
    setClosing(false);
    toast.success(action === "renew" ? "Subscription renewed" : action === "invoice" ? "Invoice created" : "Subscription updated");
    startTransition(() => { if (action === "invoice") router.push(`/invoices/${result.data.id}`); else router.refresh(); });
  }

  const move = (to: string, label: string, primary = false) => <Button key={to} size="sm" variant={primary ? "primary" : "secondary"} disabled={disabled} loading={busy === to} onClick={() => run(to, { to })}>{label}</Button>;
  return <>
    {!portal && status === "DRAFT" && move("QUOTATION", "Prepare quotation", true)}
    {!portal && status === "QUOTATION" && <>{move("CONFIRMED", "Confirm quotation", true)}{move("DRAFT", "Back to draft")}</>}
    {!portal && status === "CONFIRMED" && move("ACTIVE", "Activate subscription", true)}
    {!portal && status === "ACTIVE" && plan.pausable && move("PAUSED", "Pause")}
    {!portal && status === "PAUSED" && move("ACTIVE", "Resume", true)}
    {status === "ACTIVE" && plan.renewable && hasEndDate && <Button size="sm" disabled={disabled} loading={busy === "renew"} onClick={() => run("renew", {})}>Renew subscription</Button>}
    {!portal && status === "ACTIVE" && <Button size="sm" disabled={disabled} loading={busy === "invoice"} onClick={() => run("invoice")}>Generate invoice</Button>}
    {["ACTIVE", "PAUSED"].includes(status) && plan.closable && <Button size="sm" variant="danger" disabled={disabled} onClick={() => setClosing(true)}>Close subscription</Button>}
    <Dialog open={closing} onClose={() => { if (!disabled) setClosing(false); }} title="Close this subscription?" footer={<><Button disabled={disabled} onClick={() => setClosing(false)}>Keep subscription</Button><Button variant="danger" disabled={disabled} loading={busy === "CLOSED"} onClick={() => { if (!reason.trim()) { setReasonError("Please tell us why you are closing this subscription."); return; } setReasonError(""); void run("CLOSED", { to: "CLOSED", closeReason: reason.trim() }); }}>Close subscription</Button></>}>
      <p className="mb-4 text-sm text-muted">Future billing will stop. Existing invoices remain payable, and this subscription cannot be reopened.</p>
      <FormField label="Reason for closing" required error={reasonError}>{(field) => <Textarea {...field} rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />}</FormField>
    </Dialog>
  </>;
}

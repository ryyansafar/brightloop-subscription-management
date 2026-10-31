"use client";
// Preview how many subscriptions are due for a date, run billing after a confirmation, show the result.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, FormField, Input, StatCard, postJson, useToast } from "@/components";

interface BillingResult {
  due: number;
  invoicesCreated: number;
  periodsSkipped: number;
  subscriptionsClosed: number;
  errors: { subscriptionId: number; message: string }[];
}

const DAY_MS = 86_400_000;
const MAX_DAYS_AHEAD = 120;

function addDaysIso(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function BillingRunner({ initialDue, todayIso }: { initialDue: number; todayIso: string }) {
  const router = useRouter();
  const toast = useToast();
  const [asOf, setAsOf] = useState(todayIso);
  // The preview is stored with the date it was fetched for, so a stale count is never shown.
  const [preview, setPreview] = useState<{ asOf: string; due: number } | null>({ asOf: todayIso, due: initialDue });
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BillingResult | null>(null);

  const dateError =
    !asOf || asOf > addDaysIso(todayIso, MAX_DAYS_AHEAD)
      ? `Choose a date up to ${MAX_DAYS_AHEAD} days from today`
      : undefined;
  const simulated = !dateError && asOf > todayIso;
  const due = preview?.asOf === asOf ? preview.due : null;

  // Keep the "due" preview in step with the chosen date.
  useEffect(() => {
    if (dateError) return;
    const controller = new AbortController();
    fetch(`/api/billing/run?asOf=${asOf}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json: { ok: boolean; data?: { due: number } }) =>
        setPreview({ asOf, due: json.ok ? (json.data?.due ?? 0) : 0 }),
      )
      .catch(() => undefined);
    return () => controller.abort();
  }, [asOf, dateError]);

  async function run() {
    setRunning(true);
    const res = await postJson<BillingResult>("/api/billing/run", { asOf });
    setRunning(false);
    setConfirming(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setResult(res.data);
    setPreview({ asOf, due: 0 });
    toast.success(`${res.data.invoicesCreated} invoices created`);
    router.refresh();
  }

  return (
    <section aria-labelledby="run-heading" className="rounded-lg border border-line bg-surface p-4 md:p-6">
      <h2 id="run-heading" className="text-base font-semibold text-foreground">
        Run billing
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-end">
        <FormField label="Bill as of" error={dateError} hint="Today unless you are simulating a later billing day">
          {(f) => (
            <Input {...f} type="date" value={asOf} max={addDaysIso(todayIso, MAX_DAYS_AHEAD)} onChange={(e) => setAsOf(e.target.value)} />
          )}
        </FormField>
        <p className="text-sm text-muted" aria-live="polite">
          {dateError ? "" : due === null ? "Checking what is due…" : `${due.toLocaleString("en-IN")} subscriptions are due on or before this date.`}
        </p>
      </div>

      {simulated && (
        <p role="note" className="mt-4 rounded-md border border-line bg-info-soft px-3 py-2 text-sm text-info">
          Simulation: invoices will be created for periods that start after today. Use this to rehearse a later billing day.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setConfirming(true)} disabled={Boolean(dateError) || running}>
          {due === 0 ? "Run billing (nothing due)" : "Run billing"}
        </Button>
        <Button href="/invoices?filter=draft" variant="secondary">
          View draft invoices
        </Button>
      </div>

      {result && (
        <div className="mt-6 border-t border-line pt-5" role="status" aria-live="polite">
          <h3 className="text-sm font-semibold text-foreground">Result</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Invoices created" value={result.invoicesCreated.toLocaleString("en-IN")} tone="success" href="/invoices?filter=draft" />
            <StatCard label="Periods already invoiced" value={result.periodsSkipped.toLocaleString("en-IN")} hint="Skipped, never billed twice" />
            <StatCard label="Closed at plan end" value={result.subscriptionsClosed.toLocaleString("en-IN")} />
          </div>
          {result.invoicesCreated === 0 && result.errors.length === 0 && (
            <p className="mt-3 text-sm text-muted">Nothing new to bill: everything due was already invoiced.</p>
          )}
          {result.errors.length > 0 && (
            <div className="mt-3 rounded-md border border-line bg-danger-soft p-3 text-sm text-danger">
              <p className="font-medium">{result.errors.length} subscriptions could not be billed</p>
              <ul className="mt-1 list-disc pl-5">
                {result.errors.slice(0, 5).map((e) => (
                  <li key={e.subscriptionId}>
                    Subscription {e.subscriptionId}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={confirming}
        onClose={() => !running && setConfirming(false)}
        title="Run billing?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={running}>
              Cancel
            </Button>
            <Button variant="primary" onClick={run} loading={running}>
              Run billing
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          This creates draft invoices for {due ?? "the"} due subscriptions up to {asOf}. A period that already has an invoice is skipped, so running again is safe.
        </p>
        {simulated && <p className="mt-2 text-sm text-muted">The date is in the future, so this is a simulation.</p>}
      </Dialog>
    </section>
  );
}

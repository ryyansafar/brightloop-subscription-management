"use client";
// Owner: fathima. "Record payment" from the payments list: pick a confirmed invoice, then use the invoice's own dialog.
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button, Dialog, Input, formatDate, useToast } from "@/components";
import { formatINR } from "@/lib/money";
import { RecordPaymentDialog } from "../invoices/[id]/RecordPaymentDialog";
import { searchPayableInvoices, type PayableInvoice } from "./actions";

type Stage = "closed" | "pick" | "pay";

export function RecordPaymentButton() {
  const router = useRouter();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>("closed");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PayableInvoice[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<PayableInvoice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);

  async function load(q: string) {
    const ticket = ++latest.current;
    try {
      const found = await searchPayableInvoices(q);
      if (ticket !== latest.current) return; // a newer search is already in flight
      setFailed(false);
      setResults(found);
    } catch {
      if (ticket === latest.current) setFailed(true);
    }
  }

  function open() {
    setQuery("");
    setResults(null);
    setChosen(null);
    setStage("pick");
    void load("");
  }

  function onQueryChange(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(value), 250);
  }

  function choose(invoice: PayableInvoice) {
    setChosen(invoice);
    setStage("pay");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (results && results.length > 0) choose(results[0]);
  }

  return (
    <>
      <Button variant="primary" onClick={open}>
        Record payment
      </Button>

      <Dialog
        open={stage === "pick"}
        // The native close event also fires when we move on to the payment step; only a real dismissal closes everything.
        onClose={() => setStage((s) => (s === "pick" ? "closed" : s))}
        title="Record payment: choose invoice"
        footer={<Button onClick={() => setStage("closed")}>Cancel</Button>}
      >
        <form onSubmit={onSubmit} role="search" className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Invoice number or customer
            <Input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="e.g. INV-SUB-01692 or Mahajan"
              autoComplete="off"
            />
          </label>
          <p className="text-xs text-muted">Only confirmed invoices with an amount due are listed, oldest due date first.</p>

          {failed ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              Could not load invoices. Check your connection and try again.
            </p>
          ) : results === null ? (
            <p role="status" className="py-4 text-center text-sm text-muted">
              Loading invoices…
            </p>
          ) : results.length === 0 ? (
            <p role="status" className="py-4 text-center text-sm text-muted">
              No confirmed unpaid invoices match &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-md border border-line" aria-label="Matching invoices">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => choose(r)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{r.number}</span>
                      <span className="block truncate text-xs text-muted">
                        {r.customer} · due {formatDate(r.dueDate)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatINR(r.balance)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      </Dialog>

      {chosen && (
        <RecordPaymentDialog
          open={stage === "pay"}
          onClose={() => setStage((s) => (s === "pay" ? "closed" : s))}
          invoiceId={chosen.id}
          invoiceNumber={chosen.number}
          balance={chosen.balance}
          onRecorded={(fullyPaid) => {
            setStage("closed");
            toast.success(fullyPaid ? `${chosen.number} is now paid` : `Payment recorded on ${chosen.number}`);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

"use client";
// Searchable customer select (ARIA combobox). Queries GET /api/customers, never loads the whole table.
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components";

export interface CustomerOption {
  id: number;
  name: string;
  email: string;
  company: string | null;
}

interface CustomerPickerProps {
  id: string;
  value: CustomerOption | null;
  onChange: (customer: CustomerOption | null) => void;
  invalid?: boolean;
  "aria-describedby"?: string;
}

type LoadState = "idle" | "loading" | "error";

export function CustomerPicker({ id, value, onChange, invalid, "aria-describedby": describedBy }: CustomerPickerProps) {
  const listId = useId();
  const [text, setText] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CustomerOption[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [active, setActive] = useState(0);
  const typed = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const query = typed.current ? text.trim() : "";
    const timer = setTimeout(async () => {
      setState("loading");
      try {
        const res = await fetch(`/api/customers?limit=8&q=${encodeURIComponent(query)}`);
        const json = (await res.json()) as { ok: boolean; data?: { items: CustomerOption[] } };
        if (cancelled) return;
        if (!json.ok || !json.data) throw new Error("load failed");
        setItems(json.data.items);
        setActive(0);
        setState("idle");
      } catch {
        if (!cancelled) setState("error");
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, text]);

  function choose(customer: CustomerOption) {
    typed.current = false;
    setText(customer.name);
    onChange(customer);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      // Enter never submits the form from here: it picks the highlighted customer when one is listed.
      e.preventDefault();
      if (open && items[active] && state !== "loading") choose(items[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `${listId}-${items[active].id}` : undefined}
        aria-describedby={describedBy}
        invalid={invalid}
        autoComplete="off"
        placeholder="Search by name, company or email"
        className="min-h-11 md:min-h-10"
        value={text}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          typed.current = true;
          setText(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
      />
      {value && (
        <p className="mt-1 truncate text-xs text-muted" title={value.email}>
          {value.company ? `${value.company} · ` : ""}
          {value.email}
        </p>
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Customers"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface shadow-lg"
        >
          {state === "loading" && items.length === 0 && <li className="px-3 py-2 text-sm text-muted">Searching…</li>}
          {state === "error" && <li className="px-3 py-2 text-sm text-danger">Could not load customers. Try again.</li>}
          {state === "idle" && items.length === 0 && <li className="px-3 py-2 text-sm text-muted">No customers match.</li>}
          {items.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${c.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-primary-soft" : ""}`}
            >
              <span className="block truncate font-medium" title={c.name}>{c.name}</span>
              <span className="block truncate text-xs text-muted">
                {c.company ? `${c.company} · ` : ""}
                {c.email}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

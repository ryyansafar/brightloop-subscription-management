"use client";
// Password input with a Show/Hide toggle. Shared FormField supplies label, id and error wiring.
import { useState } from "react";
import { FormField, Input } from "@/components";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  error?: string;
  hint?: string;
  name?: string;
  describedBy?: string;
  autoFocus?: boolean;
  /** Outline the field without a message of its own (e.g. a credential error shown in a banner). */
  invalid?: boolean;
}

export function PasswordField({ label, value, onChange, autoComplete, error, hint, name, describedBy, autoFocus, invalid }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  return (
    <FormField label={label} error={error} hint={hint} required>
      {(f) => (
        <div className="relative">
          <Input
            {...f}
            invalid={f.invalid || invalid}
            aria-describedby={[f["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined}
            name={name ?? "password"}
            type={shown ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            autoCapitalize="none"
            spellCheck={false}
            className="h-11 pr-16"
          />
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            className="absolute inset-y-0 right-0 min-w-14 rounded-r-md px-3 text-xs font-medium text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            {shown ? "Hide" : "Show"}
          </button>
        </div>
      )}
    </FormField>
  );
}

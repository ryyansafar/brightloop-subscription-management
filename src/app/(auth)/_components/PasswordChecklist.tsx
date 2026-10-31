// Strength bar + live rules list. Colour is never the only signal: each rule has a tick/cross and text.
import { checkPassword, strengthOf, type Strength } from "../_lib/password-rules";

const BAR: Record<Strength, { color: string; label: string }> = {
  none: { color: "bg-line", label: "" },
  weak: { color: "bg-danger", label: "Weak" },
  fair: { color: "bg-warning", label: "Fair" },
  good: { color: "bg-info", label: "Good" },
  strong: { color: "bg-success", label: "Strong" },
};

export function PasswordChecklist({ value, id }: { value: string; id: string }) {
  const { rules, metCount } = checkPassword(value);
  const strength = strengthOf(metCount);
  const bar = BAR[strength];
  return (
    <div id={id} className="-mt-1 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className={`h-full rounded-full transition-all ${bar.color}`} style={{ width: `${(metCount / rules.length) * 100}%` }} />
        </div>
        <span className="w-12 text-right text-xs text-muted">{bar.label}</span>
      </div>
      <ul className="flex flex-col gap-1 text-xs" aria-label="Password rules">
        {rules.map((rule) => (
          <li key={rule.id} className={`flex items-center gap-2 ${rule.met ? "text-success" : "text-muted"}`}>
            <span aria-hidden className="w-3 text-center font-semibold">{rule.met ? "✓" : "✕"}</span>
            <span>{rule.label}</span>
            <span className="sr-only">{rule.met ? "(met)" : "(not met)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

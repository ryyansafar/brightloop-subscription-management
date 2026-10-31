// Client-side mirror of the server password policy (src/lib/auth/validation.ts). The server stays the authority.

export interface PasswordRule {
  id: "length" | "upper" | "lower" | "special";
  label: string;
  met: boolean;
}

const RULES: ReadonlyArray<{ id: PasswordRule["id"]; label: string; test: (value: string) => boolean }> = [
  { id: "length", label: "More than 8 characters", test: (v) => v.length > 8 },
  { id: "upper", label: "An uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "A lowercase letter", test: (v) => /[a-z]/.test(v) },
  { id: "special", label: "A special character", test: (v) => /[^\p{L}\p{N}\s]/u.test(v) },
];

export interface PasswordCheck {
  rules: PasswordRule[];
  metCount: number;
  valid: boolean;
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function checkPassword(value: string): PasswordCheck {
  const rules = RULES.map(({ id, label, test }) => ({ id, label, met: test(value) }));
  const metCount = rules.filter((r) => r.met).length;
  return { rules, metCount, valid: metCount === rules.length && byteLength(value) <= 72 };
}

/** One sentence for the first unmet rule, or the byte-limit message; null when the password is acceptable. */
export function passwordProblem(value: string): string | null {
  if (value.length === 0) return "Enter a password.";
  const first = checkPassword(value).rules.find((r) => !r.met);
  if (first) return `Password needs: ${first.label.charAt(0).toLowerCase()}${first.label.slice(1)}.`;
  return byteLength(value) > 72 ? "Password is too long. Use 72 bytes or fewer." : null;
}

export type Strength = "none" | "weak" | "fair" | "good" | "strong";

export function strengthOf(metCount: number): Strength {
  return (["none", "weak", "fair", "good", "strong"] as const)[Math.min(Math.max(metCount, 0), 4)];
}

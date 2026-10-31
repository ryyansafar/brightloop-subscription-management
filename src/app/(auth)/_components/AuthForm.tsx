"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, FormField, Input, postJson } from "@/components";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "@/lib/auth/validation";
import { loginDestination } from "@/lib/auth/navigation";
import type { Role } from "@/lib/state";

export type AuthMode = "login" | "signup" | "forgot" | "reset" | "staff";
const labels: Record<AuthMode, string> = {
  login: "Sign in", signup: "Create account", forgot: "Send reset link", reset: "Save new password", staff: "Create staff account",
};

export function AuthForm({ mode, next, token, recoveryAvailable = true }: {
  mode: AuthMode; next?: string; token?: string; recoveryAvailable?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState("");
  const newAccount = mode === "signup" || mode === "staff";
  const newPassword = newAccount || mode === "reset";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form));
    const confirmation = raw.confirmPassword;
    delete raw.confirmPassword;
    if (mode === "reset") raw.token = token || "";
    const schema = newAccount ? signupSchema : mode === "login" ? loginSchema : mode === "forgot" ? forgotPasswordSchema : resetPasswordSchema;
    const parsed = schema.safeParse(raw);
    const fieldErrors: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] || "input")] ??= issue.message;
    if (newPassword && raw.password !== confirmation) fieldErrors.confirmPassword = "Passwords do not match";
    setErrors(fieldErrors);
    setError(""); setMessage(""); setResetLink("");
    if (!parsed.success || Object.keys(fieldErrors).length) return;
    setBusy(true);
    const endpoint = mode === "staff" ? "/admin/staff/accounts" : `/api/auth/${mode === "forgot" ? "forgot-password" : mode === "reset" ? "reset-password" : mode}`;
    const result = await postJson<{ role?: Role; message?: string; devResetUrl?: string; verificationRequired?: boolean; devVerificationUrl?: string }>(endpoint, parsed.data);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    if (mode === "login" || mode === "signup") {
      // Clear credentials before navigation so a restored route cannot retain password inputs.
      form.reset(); setVisible(false);
      if (result.data.verificationRequired) {
        const preview = result.data.devVerificationUrl ? new URL(result.data.devVerificationUrl) : null;
        const shortcut = preview ? preview.search + preview.hash : "?sent=1";
        router.replace(`/verify-email${shortcut}`);
        router.refresh();
        return;
      }
      router.replace(loginDestination(next, result.data.role || "CUSTOMER"));
      router.refresh();
    } else if (mode === "staff") {
      form.reset(); setMessage("Staff account created. They can now sign in with these credentials."); router.refresh();
    } else {
      setMessage(result.data.message || "Your request has been received.");
      if (mode === "forgot" && result.data.devResetUrl) {
        // Only use an internal reset-page URL, even if a response is unexpectedly malformed.
        try {
          const link = new URL(result.data.devResetUrl);
          if (link.pathname === "/reset-password") setResetLink(link.pathname + link.search);
        } catch { /* The confirmation remains usable without a development shortcut. */ }
      }
      form.reset();
    }
  }

  if (mode === "reset" && !token?.match(/^[a-f0-9]{64}$/)) return <div className="space-y-4">
    <p role="alert" className="rounded-lg bg-danger-soft p-4 text-sm text-danger">This reset link is incomplete. Request a new link to continue.</p>
    <Button href="/forgot-password" variant="primary">Request a reset link</Button>
  </div>;

  if (mode === "reset" && message) return <div className="space-y-5">
    <p role="status" className="rounded-lg bg-success-soft p-4 text-sm text-success">{message}</p>
    <Button href="/login" variant="primary" className="w-full">Back to sign in</Button>
  </div>;

  return <form onSubmit={submit} noValidate className="space-y-5" aria-busy={busy}>
    {newAccount && <FormField label="Full name" required error={errors.name}>{(field) => <Input {...field} name="name" autoComplete="name" placeholder="Your full name" maxLength={100} />}</FormField>}
    {mode !== "reset" && <FormField label="Email address" required error={errors.email}>{(field) => <Input {...field} name="email" type="email" autoComplete="email" placeholder="you@company.com" maxLength={254} />}</FormField>}
    {mode !== "forgot" && <FormField label={mode === "reset" ? "New password" : "Password"} required error={errors.password}
      hint={newPassword ? "Use at least 9 characters with uppercase, lowercase and a special character." : undefined}>
      {(field) => <div className="relative"><Input {...field} name="password" type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"} className="pr-20" />
        <button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible} aria-label={visible ? "Hide password" : "Show password"} className="absolute inset-y-0 right-3 text-xs font-medium text-primary">{visible ? "Hide" : "Show"}</button>
      </div>}
    </FormField>}
    {newPassword && <FormField label="Confirm password" required error={errors.confirmPassword}>{(field) => <Input {...field} name="confirmPassword" type={visible ? "text" : "password"} autoComplete="new-password" />}</FormField>}
    {mode === "login" && <div className="text-right"><Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">Forgot password?</Link></div>}
    {mode === "forgot" && !recoveryAvailable && <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">Password recovery is unavailable right now. Please contact your administrator.</p>}
    {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-success-soft p-3 text-sm text-success">{message}</p>}
    {resetLink && <p className="text-sm"><Link href={resetLink} className="font-medium text-primary underline">Open your development reset link</Link></p>}
    <Button type="submit" variant="primary" loading={busy} disabled={mode === "forgot" && !recoveryAvailable} className="w-full">{labels[mode]}</Button>
    {mode === "login" && <p className="text-center text-sm text-muted">New to Brightloop? <Link href="/signup" className="font-medium text-primary hover:underline">Create an account</Link></p>}
    {mode === "signup" && <p className="text-center text-sm text-muted">Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link></p>}
    {mode === "forgot" && <p className="text-center text-sm"><Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link></p>}
  </form>;
}

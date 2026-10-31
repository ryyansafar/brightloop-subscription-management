"use client";
import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button, postJson } from "@/components";
import { focusFirstInvalid } from "../_lib/form";
import { passwordProblem } from "../_lib/password-rules";
import { Alert } from "./Alert";
import { AuthCard, AUTH_LINK } from "./AuthCard";
import { PasswordChecklist } from "./PasswordChecklist";
import { PasswordField } from "./PasswordField";

const REQUEST_NEW = (
  <Link href="/forgot-password" className={AUTH_LINK}>
    Request a new link
  </Link>
);

export function ResetPasswordForm({ token }: { token: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const rulesId = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return (
      <AuthCard title="Reset link not valid" subtitle="This link is missing or incomplete. Reset links are single-use and expire after 30 minutes.">
        <div>{REQUEST_NEW}</div>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated" subtitle="You have been signed out everywhere. Sign in with your new password.">
        <Alert tone="success">Your password was changed.</Alert>
        <Button href="/login" variant="primary" className="h-11 w-full">
          Go to sign in
        </Button>
      </AuthCard>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    const found = {
      password: passwordProblem(password) ?? undefined,
      confirm: confirm === password ? undefined : "Passwords do not match.",
    };
    setErrors(found);
    setFormError(null);
    if (found.password || found.confirm) return focusFirstInvalid(formRef.current);
    setLoading(true);
    const res = await postJson("/api/auth/reset-password", { token, password });
    setLoading(false);
    if (res.ok) setDone(true);
    else setFormError(/token|expired|invalid/i.test(res.error) ? "This reset link is invalid or has expired. Request a new one." : res.error);
  }

  const matches = confirm.length > 0 && confirm === password;
  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Use the rules below. You will be signed out everywhere else."
      footer={<>Link expired? {REQUEST_NEW}</>}
    >
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" error={errors.password} describedBy={rulesId} autoFocus />
        <PasswordChecklist value={password} id={rulesId} />
        <PasswordField
          label="Confirm new password"
          name="confirm"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={errors.confirm}
          hint={matches ? "✓ Passwords match" : undefined}
        />
        <Button type="submit" variant="primary" loading={loading} className="h-11 w-full">
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthCard>
  );
}

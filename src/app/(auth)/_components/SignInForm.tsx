"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Button, FormField, Input, postJson } from "@/components";
import { destinationFor } from "../_lib/safe-redirect";
import { focusFirstInvalid, isEmail } from "../_lib/form";
import { Alert } from "./Alert";
import { AUTH_LINK } from "./AuthCard";
import { PasswordField } from "./PasswordField";

const GENERIC_ERROR = "Incorrect email or password. Please try again.";

interface SessionUser {
  role: string;
}

export function SignInForm({ next }: { next: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Credential failures outline both fields (never just one, which would hint which was wrong).
  const [bothInvalid, setBothInvalid] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    const fieldErrors = {
      email: isEmail(email) ? undefined : "Enter a valid email address.",
      password: password ? undefined : "Enter your password.",
    };
    setErrors(fieldErrors);
    setFormError(null);
    setBothInvalid(false);
    if (fieldErrors.email || fieldErrors.password) return focusFirstInvalid(formRef.current);

    setLoading(true);
    const res = await postJson<SessionUser>("/api/auth/login", { email: email.trim(), password });
    if (res.ok) {
      // Full navigation so the server layout reads the fresh session cookie.
      window.location.assign(destinationFor(res.data.role, next));
      return;
    }
    setLoading(false);
    // Never reveal which half was wrong; only surface non-credential problems (rate limit, offline).
    const credentialIssue = /incorrect|^(email|password|input):/i.test(res.error);
    setFormError(credentialIssue ? GENERIC_ERROR : res.error);
    setBothInvalid(credentialIssue);
    setPassword("");
    if (credentialIssue) focusFirstInvalid(formRef.current);
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {formError && <Alert tone="error">{formError}</Alert>}
      <FormField label="Email" error={errors.email} required>
        {(f) => (
          <Input
            {...f}
            invalid={f.invalid || bothInvalid}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        )}
      </FormField>
      <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" error={errors.password} invalid={bothInvalid} />
      <div className="-mt-2 flex justify-end">
        <Link href="/forgot-password" className={AUTH_LINK}>
          Forgot password?
        </Link>
      </div>
      <Button type="submit" variant="primary" loading={loading} className="h-11 w-full">
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

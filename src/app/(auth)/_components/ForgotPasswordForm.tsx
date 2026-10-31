"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Button, FormField, Input, postJson } from "@/components";
import { focusFirstInvalid, isEmail } from "../_lib/form";
import { Alert } from "./Alert";
import { AuthCard, AUTH_LINK } from "./AuthCard";

interface ForgotResult {
  devResetUrl?: string;
}

/** Only follow a dev link that points at this very origin. */
function sameOriginUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin ? parsed.href : null;
  } catch {
    return null;
  }
}

export function ForgotPasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setFormError(null);
    if (!isEmail(email)) {
      setError("Enter a valid email address.");
      return focusFirstInvalid(formRef.current);
    }
    setError(null);
    setLoading(true);
    const res = await postJson<ForgotResult>("/api/auth/forgot-password", { email: email.trim() });
    setLoading(false);
    if (res.ok) {
      setDevUrl(sameOriginUrl(res.data?.devResetUrl));
      setSent(true);
    } else if (/^email:/i.test(res.error)) {
      setError("Enter a valid email address.");
    } else {
      setFormError(res.error);
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your account email and we will send a reset link valid for 30 minutes."
    >
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <FormField label="Email" error={error ?? undefined} required>
          {(f) => (
            <Input
              {...f}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              readOnly={sent}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          )}
        </FormField>
        {sent ? (
          <>
            <Alert tone="success">If that email is registered, a reset link is on its way. Check your inbox.</Alert>
            {devUrl && (
              <Alert tone="info">
                <strong>Development only:</strong> no email is sent locally.{" "}
                <a href={devUrl} className="font-medium underline">
                  Open the reset link
                </a>
              </Alert>
            )}
          </>
        ) : (
          <Button type="submit" variant="primary" loading={loading} className="h-11 w-full">
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        )}
      </form>
      <Link href="/login" className={`${AUTH_LINK} -mt-2 self-start`}>
        ← Back to sign in
      </Link>
    </AuthCard>
  );
}

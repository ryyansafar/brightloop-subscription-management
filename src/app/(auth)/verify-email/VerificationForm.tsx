"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Button, FormField, Input, postJson } from "@/components";

function subscribeHash(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}

export function VerificationForm({ token: queryToken }: { token?: string }) {
  const token = useSyncExternalStore(subscribeHash,
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") || queryToken || "",
    () => queryToken || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verified, setVerified] = useState(false);
  const [preview, setPreview] = useState("");
  const validToken = !!token?.match(/^[a-f0-9]{64}$/);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setPreview("");
    const form = event.currentTarget;
    const result = await postJson<{ message: string; devVerificationUrl?: string }>(
      validToken ? "/api/auth/verify-email" : "/api/auth/resend-verification",
      validToken ? { token } : { email: String(new FormData(form).get("email") || "") },
    );
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setMessage(result.data.message);
    if (validToken) setVerified(true);
    else {
      form.reset();
      if (result.data.devVerificationUrl) {
        try {
          const url = new URL(result.data.devVerificationUrl);
          if (url.pathname === "/verify-email") setPreview(url.pathname + url.search + url.hash);
        } catch { /* No development shortcut is needed for the confirmation. */ }
      }
    }
  }

  if (verified) return <div className="space-y-5"><p role="status" className="rounded-lg bg-success-soft p-4 text-sm text-success">{message}</p><Button href="/login" variant="primary">Back to sign in</Button></div>;
  return <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
    <p className="text-sm text-muted">{validToken ? "Confirm that this email address belongs to you. This link can be used once." : "Check your inbox for a verification link. Enter your account email below if you need another one."}</p>
    {!validToken && <FormField label="Email address" required>{(field) => <Input {...field} name="email" type="email" autoComplete="email" maxLength={254} />}</FormField>}
    {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-success-soft p-3 text-sm text-success">{message}</p>}
    {preview && <Button href={preview}>Open development verification link</Button>}
    <Button type="submit" variant="primary" loading={busy}>{validToken ? "Verify email" : "Send verification link"}</Button>
    <div><Button href="/login" variant="ghost">Back to sign in</Button></div>
  </form>;
}

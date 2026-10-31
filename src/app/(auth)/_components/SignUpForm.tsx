"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button, FormField, Input, postJson } from "@/components";
import { focusFirstInvalid, isEmail } from "../_lib/form";
import { passwordProblem } from "../_lib/password-rules";
import { Alert } from "./Alert";
import { PasswordChecklist } from "./PasswordChecklist";
import { PasswordField } from "./PasswordField";

type Errors = Partial<Record<"name" | "email" | "password" | "confirm", string>>;

export function SignUpForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const rulesId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    const found: Errors = {
      name: name.trim() ? undefined : "Enter your full name.",
      email: isEmail(email) ? undefined : "Enter a valid email address.",
      password: passwordProblem(password) ?? undefined,
      confirm: confirm === password ? undefined : "Passwords do not match.",
    };
    setErrors(found);
    setFormError(null);
    if (Object.values(found).some(Boolean)) return focusFirstInvalid(formRef.current);

    setLoading(true);
    const res = await postJson("/api/auth/signup", { name: name.trim(), email: email.trim(), password });
    if (res.ok) {
      window.location.assign(new URL("/portal", window.location.origin).href);
      return;
    }
    setLoading(false);
    if (/already exists/i.test(res.error)) {
      setErrors({ email: "An account with this email already exists. Try signing in instead." });
      focusFirstInvalid(formRef.current);
    } else {
      setFormError(res.error.replace(/^(name|email|password|input):\s*/i, ""));
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {formError && <Alert tone="error">{formError}</Alert>}
      <FormField label="Full name" error={errors.name} required>
        {(f) => (
          <Input {...f} name="name" autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
        )}
      </FormField>
      <FormField label="Email" error={errors.email} required>
        {(f) => (
          <Input
            {...f}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        )}
      </FormField>
      <PasswordField
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        error={errors.password}
        describedBy={rulesId}
      />
      <PasswordChecklist value={password} id={rulesId} />
      <PasswordField
        label="Confirm password"
        name="confirm"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        error={errors.confirm}
      />
      <Button type="submit" variant="primary" loading={loading} className="h-11 w-full">
        {loading ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

"use client";
// "Add staff member" button and dialog. POST /admin/staff/accounts creates STAFF accounts only, so Role is
// shown as fixed text rather than a select that would do nothing.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Dialog, FormField, Input, postJson, useToast } from "@/components";
import { mapApiError, passwordRules, validateStaff, type FieldErrors, type StaffInput } from "./rules";

const EMPTY: StaffInput = { name: "", email: "", password: "" };
const FIELD_ORDER = ["name", "email", "password"] as const;

export function AddStaffDialog() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<StaffInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  /** The shared Input has no ref prop, so fields are found by name inside this form. */
  function focusField(name: string) {
    const el = form.current?.elements.namedItem(name);
    if (el instanceof HTMLElement) el.focus();
  }

  useEffect(() => {
    if (open) focusField("name");
  }, [open]);

  function show() {
    setValues(EMPTY);
    setErrors({});
    setShowPassword(false);
    setOpen(true);
  }

  function set(field: keyof StaffInput, value: string) {
    setValues({ ...values, [field]: value });
    if (errors[field] || errors.form) setErrors({ ...errors, [field]: undefined, form: undefined });
  }

  function focusFirstError(found: FieldErrors) {
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) focusField(first);
  }

  async function submit() {
    const found = validateStaff(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusFirstError(found);
      return;
    }
    setBusy(true);
    const result = await postJson("/admin/staff/accounts", {
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    });
    setBusy(false);
    if (!result.ok) {
      const mapped = mapApiError(result.error);
      setErrors(mapped);
      focusFirstError(mapped);
      if (mapped.form) toast.error(mapped.form);
      return;
    }
    setOpen(false);
    toast.success(`${values.name.trim()} was added as staff. They must change the temporary password at first sign-in.`);
    router.refresh();
  }

  const rules = passwordRules(values.password);

  return (
    <>
      <Button variant="primary" className="min-h-11 md:min-h-10" onClick={show} aria-haspopup="dialog">
        Add staff member
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add staff member">
        <form
          ref={form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-4"
        >
          {errors.form && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {errors.form}
            </p>
          )}
          <FormField label="Full name" required error={errors.name}>
            {(f) => (
              <Input
                {...f}
                name="name"
                autoComplete="off"
                maxLength={100}
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Email" required error={errors.email}>
            {(f) => (
              <Input
                {...f}
                name="email"
                type="email"
                autoComplete="off"
                inputMode="email"
                maxLength={254}
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
              />
            )}
          </FormField>

          <div className="flex flex-col gap-2">
            <FormField label="Temporary password" required error={errors.password}>
              {(f) => (
                <div className="flex gap-2">
                  <Input
                    {...f}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={values.password}
                    aria-describedby={[f["aria-describedby"], "staff-password-rules"].filter(Boolean).join(" ")}
                    onChange={(e) => set("password", e.target.value)}
                  />
                  <Button
                    className="min-h-11 shrink-0 md:min-h-10"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Button>
                </div>
              )}
            </FormField>
            <ul id="staff-password-rules" aria-label="Password rules" className="flex flex-col gap-0.5 text-xs">
              {rules.map((r) => (
                <li key={r.label} className={r.met ? "text-success" : "text-muted"}>
                  <span aria-hidden>{r.met ? "✓" : "✕"}</span> {r.label}
                  <span className="sr-only">{r.met ? " (met)" : " (not met)"}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">The staff member must change this password at first sign-in.</p>
          </div>

          <FormField
            label="Role"
            required
            hint="Staff can manage subscriptions, invoices and payments, and can view the catalog. Only admins change the catalog, discounts, taxes and staff accounts. New accounts are always Staff; promoting someone to admin is not available here."
          >
            {(f) => <Input {...f} readOnly value="Staff" aria-readonly />}
          </FormField>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="min-h-11 w-full sm:w-auto" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="min-h-11 w-full sm:w-auto" loading={busy}>
              Add staff member
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

// Pure client-side checks for the Add staff member form. They mirror src/lib/auth/validation.ts;
// the server stays the authority and its messages are mapped back onto fields by mapApiError().

export interface PasswordRule {
  label: string;
  met: boolean;
}

/** In the order and wording shown to the admin. */
export function passwordRules(password: string): PasswordRule[] {
  return [
    { label: "More than 8 characters", met: password.length > 8 },
    { label: "An uppercase letter", met: /[A-Z]/.test(password) },
    { label: "A lowercase letter", met: /[a-z]/.test(password) },
    { label: "A special character", met: /[^\p{L}\p{N}\s]/u.test(password) },
  ];
}

export const MAX_PASSWORD_BYTES = 72;

export function passwordTooLong(password: string): boolean {
  return new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES;
}

export type StaffField = "name" | "email" | "password";
export type FieldErrors = Partial<Record<StaffField | "form", string>>;

export interface StaffInput {
  name: string;
  email: string;
  password: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStaff(input: StaffInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.name.trim()) errors.name = "Enter the staff member's full name.";
  if (!EMAIL.test(input.email.trim())) errors.email = "Enter a valid email address, e.g. name@brightloop.test.";
  if (passwordTooLong(input.password)) errors.password = "Use at most 72 bytes; shorten the password.";
  else if (passwordRules(input.password).some((r) => !r.met)) {
    errors.password = "The password does not meet all the rules below.";
  }
  return errors;
}

/** Turn the API's single error string ("email: Enter a valid...; password: ...") into per-field errors. */
export function mapApiError(message: string): FieldErrors {
  if (/already exists/i.test(message)) return { email: "A user with this email already exists." };
  const errors: FieldErrors = {};
  for (const part of message.split(";")) {
    const match = /^\s*(name|email|password):\s*(.+)$/.exec(part);
    if (match) errors[match[1] as StaffField] = match[2].trim();
  }
  return Object.keys(errors).length > 0 ? errors : { form: message };
}

import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const passwordSchema = z.string()
  .refine((value) => !value.includes("\0"), "Password must not contain a null character")
  .min(9, "Password must be longer than 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[^\p{L}\p{N}\s]/u, "Password must contain a special character")
  // bcrypt truncates after 72 bytes; reject rather than silently accept a different password.
  .refine((value) => new TextEncoder().encode(value).byteLength <= 72, "Password must be at most 72 UTF-8 bytes");

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: emailSchema,
  password: passwordSchema,
}).strict();

export const loginSchema = z.object({
  email: emailSchema,
  // Login must continue to work for existing accounts, independently of signup policy.
  password: z.string().min(1, "Password is required")
    .refine((value) => new TextEncoder().encode(value).byteLength <= 72, "Password must be at most 72 UTF-8 bytes"),
}).strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();
export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "Invalid reset token"),
  password: passwordSchema,
}).strict();

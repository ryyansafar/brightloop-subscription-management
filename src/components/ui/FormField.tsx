// Owner: fathima. Label + control + error/hint. Use the Input/Select/Textarea below as the control.
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const CONTROL =
  "w-full rounded-md border bg-surface px-3 text-sm text-foreground placeholder:text-muted " +
  "focus:outline-2 focus:outline-offset-0 focus:outline-primary disabled:bg-surface-2 disabled:text-muted";

function controlClass(invalid?: boolean, extra = "") {
  return `${CONTROL} ${invalid ? "border-danger" : "border-line"} ${extra}`;
}

type Invalid = { invalid?: boolean };

export function Input({ invalid, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & Invalid) {
  return <input aria-invalid={invalid || undefined} className={controlClass(invalid, `h-10 ${className}`)} {...props} />;
}

export function Select({ invalid, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement> & Invalid) {
  return <select aria-invalid={invalid || undefined} className={controlClass(invalid, `h-10 ${className}`)} {...props} />;
}

export function Textarea({ invalid, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & Invalid) {
  return <textarea aria-invalid={invalid || undefined} className={controlClass(invalid, `py-2 ${className}`)} {...props} />;
}

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Either a render function that receives the id/aria props, or a ready control. */
  children: ReactNode | ((field: { id: string; invalid: boolean; "aria-describedby"?: string }) => ReactNode);
}

/**
 * <FormField label="Email" error={errors.email}>
 *   {(f) => <Input {...f} name="email" type="email" />}
 * </FormField>
 */
export function FormField({ label, error, hint, required, children }: FormFieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const field = { id, invalid: Boolean(error), "aria-describedby": error || hint ? noteId : undefined };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {typeof children === "function" ? children(field) : children}
      {error ? (
        <p id={noteId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

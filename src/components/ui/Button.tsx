// Owner: fathima. One button for the whole app; pass `href` to render a link that looks the same.
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover border-transparent",
  secondary: "bg-surface text-foreground hover:bg-surface-2 border-line",
  danger: "bg-surface text-danger hover:bg-danger-soft border-line",
  ghost: "bg-transparent text-foreground hover:bg-surface-2 border-transparent",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-10 px-3 text-sm md:h-8",
  md: "h-10 px-4 text-sm",
};

export function buttonClasses(variant: ButtonVariant = "secondary", size: ButtonSize = "md") {
  return [
    "inline-flex items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap",
    "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
  ].join(" ");
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };

type LinkProps = CommonProps & { href: string };

export function Button(props: ButtonProps | LinkProps) {
  const { variant, size, loading, children, className = "", href, ...rest } = props as ButtonProps & {
    href?: string;
  };
  const classes = `${buttonClasses(variant, size)} ${className}`;

  if (href !== undefined) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" {...rest} disabled={rest.disabled || loading} className={classes}>
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

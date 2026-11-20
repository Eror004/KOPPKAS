import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; loading?: boolean };
export function Button({ variant = "primary", loading = false, disabled, children, className = "", type = "button", ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={`ui-button ui-button--${variant} ${className}`}>
    {loading && <span className="ui-spinner" aria-hidden="true" />}{children}
  </button>;
}

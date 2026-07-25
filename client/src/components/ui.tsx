import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "warning";
type ButtonSize = "sm" | "md";

/*
 * macOS push buttons. `primary` is the *default* button — the accent-filled one
 * Return activates — and `secondary` is the standard bezel: a light surface with
 * a hairline, not an outline. Both carry a 1px highlight shadow, which is what
 * stops a flat rectangle from reading as web-flat.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-[0_1px_1px_rgb(0_0_0/0.10)] hover:bg-accent-hover disabled:bg-accent/40",
  secondary:
    "border border-separator bg-content text-ink shadow-[0_1px_1px_rgb(0_0_0/0.04)] hover:bg-fill/10 disabled:text-ink/65",
  ghost: "text-ink/70 hover:bg-fill/12 hover:text-ink",
  danger: "bg-danger text-status-ink shadow-[0_1px_1px_rgb(0_0_0/0.10)] hover:opacity-90 disabled:bg-danger/40",
  warning:
    "bg-warning text-status-ink shadow-[0_1px_1px_rgb(0_0_0/0.10)] hover:opacity-90 disabled:bg-warning/40",
};

// 44px on touch, macOS's tighter 28/32px once there's a pointer.
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-2.5 text-xs lg:min-h-7",
  md: "min-h-11 px-3.5 text-sm lg:min-h-8",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex select-none items-center justify-center gap-1.5 rounded-control font-medium transition-colors",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink/65">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("card", className)}>{children}</div>;
}

export function SectionHeading({
  title,
  action,
  description,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="text-xs text-ink/70">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-separator px-6 py-10 text-center">
      {icon && <div className="mb-2 text-ink/55">{icon}</div>}
      <p className="text-sm font-medium text-ink/80">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-ink/70">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded bg-fill/25", className)} />;
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 p-4">
      <p className="text-sm font-medium text-danger">Something went wrong</p>
      <p className="mt-1 text-xs text-danger">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Small initial-avatar used wherever a person or business needs a face. */
export function Avatar({
  label,
  className,
  tone = "brand",
}: {
  label: string;
  className?: string;
  tone?: "brand" | "slate";
}) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        // Solid accent rather than a 15% tint: accent-on-tint measured 3.5:1 in
        // the dark appearance, and macOS draws initial chips filled anyway.
        tone === "brand" ? "bg-accent text-accent-ink" : "bg-fill/25 text-ink/70",
        className ?? "h-8 w-8"
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}

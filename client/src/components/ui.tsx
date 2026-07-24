import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "warning";
type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/50",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50",
  warning: "bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-600/50",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
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
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
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
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
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
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-xs text-slate-500">{description}</p>}
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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center">
      {icon && <div className="mb-2 text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded bg-slate-200", className)} />;
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-800">Something went wrong</p>
      <p className="mt-1 text-xs text-red-700">{message}</p>
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
        tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-600",
        className ?? "h-8 w-8"
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}

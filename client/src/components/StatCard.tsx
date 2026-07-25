import clsx from "clsx";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  tone?: "default" | "success" | "warning" | "danger";
  sublabel?: string;
  icon?: ReactNode;
}

const TONE_STYLES = {
  default: "text-ink",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function StatCard({ label, value, trend, tone = "default", sublabel, icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-separator/70 bg-content p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-ink/70">{label}</p>
        {icon && <span className="text-ink/55">{icon}</span>}
      </div>
      <p className={clsx("mt-1 text-3xl font-semibold tabular-nums", TONE_STYLES[tone])}>{value}</p>
      {trend && (
        <p
          className={clsx(
            "mt-1 text-xs",
            trend.direction === "up"
              ? "text-success"
              : trend.direction === "down"
                ? "text-danger"
                : "text-ink/65"
          )}
        >
          {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "—"} {trend.label}
        </p>
      )}
      {!trend && sublabel && <p className="mt-1 text-xs text-ink/65">{sublabel}</p>}
    </div>
  );
}

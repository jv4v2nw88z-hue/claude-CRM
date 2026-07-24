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
  default: "text-slate-900",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-red-600",
};

export function StatCard({ label, value, trend, tone = "default", sublabel, icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <span className="text-slate-300">{icon}</span>}
      </div>
      <p className={clsx("mt-1 text-3xl font-semibold tabular-nums", TONE_STYLES[tone])}>{value}</p>
      {trend && (
        <p
          className={clsx(
            "mt-1 text-xs",
            trend.direction === "up"
              ? "text-emerald-600"
              : trend.direction === "down"
                ? "text-red-600"
                : "text-slate-400"
          )}
        >
          {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "—"} {trend.label}
        </p>
      )}
      {!trend && sublabel && <p className="mt-1 text-xs text-slate-400">{sublabel}</p>}
    </div>
  );
}

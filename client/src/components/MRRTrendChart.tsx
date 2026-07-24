import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MrrTrendPoint } from "../types";
import { formatCurrency, monthLabel } from "../lib/format";
import { EmptyState } from "./ui";

export function MRRTrendChart({
  data,
  height = 220,
}: {
  data: MrrTrendPoint[] | undefined;
  height?: number;
}) {
  const points = data ?? [];

  if (points.length === 0 || points.every((p) => p.mrr === 0)) {
    return (
      <EmptyState
        title="No recurring revenue yet"
        description="Once a retainer goes active, its monthly amount shows up here."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={monthLabel}
          tick={{ fontSize: 12, fill: "#64748B" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(value: number) => `$${value >= 1000 ? `${value / 1000}k` : value}`}
          tick={{ fontSize: 12, fill: "#64748B" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(value), "MRR"]}
          labelFormatter={(label: string) => monthLabel(label)}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            fontSize: 12,
            boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
          }}
        />
        <Line
          type="monotone"
          dataKey="mrr"
          stroke="#059669"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#059669" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

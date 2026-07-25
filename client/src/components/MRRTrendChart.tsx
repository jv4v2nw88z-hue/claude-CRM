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
import { useChartTheme } from "../lib/chartTheme";
import { EmptyState } from "./ui";

export function MRRTrendChart({
  data,
  height = 220,
}: {
  data: MrrTrendPoint[] | undefined;
  height?: number;
}) {
  const theme = useChartTheme();
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
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={monthLabel}
          tick={{ fontSize: 12, fill: theme.axis }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(value: number) => `$${value >= 1000 ? `${value / 1000}k` : value}`}
          tick={{ fontSize: 12, fill: theme.axis }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(value), "MRR"]}
          labelFormatter={(label: string) => monthLabel(label)}
          contentStyle={{
            borderRadius: 8,
            border: `1px solid ${theme.tooltipBorder}`,
            background: theme.tooltipBg,
            color: theme.tooltipInk,
            fontSize: 12,
            boxShadow: "0 8px 24px rgb(0 0 0 / 0.18)",
          }}
          itemStyle={{ color: theme.tooltipInk }}
          labelStyle={{ color: theme.tooltipInk }}
        />
        <Line
          type="monotone"
          dataKey="mrr"
          stroke={theme.line}
          strokeWidth={2.5}
          dot={{ r: 3, fill: theme.line }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

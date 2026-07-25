import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRevenueSummary } from "../hooks/queries";
import type { RetainerStatus, ServiceTierType } from "../types";
import { formatCurrency, formatDate, TIER_LABELS } from "../lib/format";
import { MRRTrendChart } from "../components/MRRTrendChart";
import { useChartTheme } from "../lib/chartTheme";
import { StatCard } from "../components/StatCard";
import { TierBadge } from "../components/TierBadge";
import { Card, EmptyState, ErrorNotice, SectionHeading, Skeleton } from "../components/ui";

const TIER_CHART_COLORS: Partial<Record<ServiceTierType, string>> = {
  WEBSITE_BUILD: "#3B82F6",
  WEBSITE_LIVE: "#D97706",
  BRAND_CURATION: "#9333EA",
  SOCIAL_MEDIA: "#0D9488",
  ANALYTICS: "#4F46E5",
  PROSPECT: "#94A3B8",
  CHURNED: "#DC2626",
};

const STATUS_STYLES: Record<RetainerStatus, string> = {
  ACTIVE: "bg-success/15 text-success",
  PAUSED: "bg-warning/15 text-warning",
  CANCELLED: "bg-danger/15 text-danger",
  PENDING_FIRST_PAYMENT: "bg-fill/15 text-ink/70",
};

const STATUS_LABELS: Record<RetainerStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
  PENDING_FIRST_PAYMENT: "Pending",
};

export function Revenue() {
  const theme = useChartTheme();
  const revenueQuery = useRevenueSummary();
  const data = revenueQuery.data;

  const tierChartData = Object.entries(data?.mrrByTier ?? {}).map(([tier, mrr]) => ({
    tier: TIER_LABELS[tier as ServiceTierType],
    tierKey: tier as ServiceTierType,
    mrr: mrr ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Revenue</h1>
        <p className="text-sm text-ink/70">
          Every retainer across the book, and whether the ladder is working.
        </p>
      </div>

      {revenueQuery.isError && (
        <ErrorNotice
          message={(revenueQuery.error as Error).message}
          onRetry={() => revenueQuery.refetch()}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {revenueQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[7.5rem]" />)
        ) : (
          <>
            <StatCard
              label="Total Active MRR"
              value={formatCurrency(data?.totalActiveMRR)}
              tone="success"
              sublabel="Retainers currently billing"
            />
            <StatCard
              label="MRR Pending"
              value={formatCurrency(data?.pendingMRR)}
              tone="warning"
              sublabel="Signed, awaiting first payment"
            />
            <StatCard
              label="MRR Lost This Quarter"
              value={formatCurrency(data?.lostThisQuarter)}
              tone={(data?.lostThisQuarter ?? 0) > 0 ? "danger" : "default"}
              sublabel="From cancelled retainers"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading title="MRR Trend" description="Last 6 months" />
          {revenueQuery.isLoading ? (
            <Skeleton className="h-[280px]" />
          ) : (
            <MRRTrendChart data={data?.mrrTrend} height={280} />
          )}
        </Card>

        <Card className="p-5">
          <SectionHeading
            title="MRR by Tier"
            description="Which rung of the ladder pays the bills"
          />
          {revenueQuery.isLoading ? (
            <Skeleton className="h-[280px]" />
          ) : tierChartData.length === 0 ? (
            <EmptyState
              title="No active retainers"
              description="Once a retainer goes active it shows up in this breakdown."
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tierChartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                <XAxis
                  dataKey="tier"
                  tick={{ fontSize: 11, fill: theme.axis }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
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
                  cursor={{ fill: theme.cursor }}
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${theme.tooltipBorder}`,
                    background: theme.tooltipBg,
                    color: theme.tooltipInk,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="mrr" radius={[4, 4, 0, 0]}>
                  {tierChartData.map((entry) => (
                    <Cell key={entry.tierKey} fill={TIER_CHART_COLORS[entry.tierKey] ?? "#4F46E5"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeading title="All Retainers" />

        {revenueQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (data?.retainers.length ?? 0) === 0 ? (
          <EmptyState
            title="No retainers yet"
            description="Add a retainer from any client page to start tracking recurring revenue."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-separator/70 text-xs uppercase tracking-wide text-ink/70">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">Client</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Tier</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Monthly</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Start</th>
                  <th scope="col" className="py-2 font-medium">End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator/50">
                {data?.retainers.map((retainer) => (
                  <tr key={retainer.id} className="hover:bg-fill/8">
                    <td className="py-2.5 pr-3">
                      {retainer.client ? (
                        <Link
                          to={`/clients/${retainer.client.id}`}
                          className="font-medium text-ink hover:text-accent hover:underline"
                        >
                          {retainer.client.businessName}
                        </Link>
                      ) : (
                        <span className="text-ink/65">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <TierBadge tier={retainer.tier} />
                    </td>
                    <td className="py-2.5 pr-3 text-right font-medium tabular-nums text-ink">
                      {formatCurrency(retainer.monthlyAmount)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[retainer.status]}`}
                      >
                        {STATUS_LABELS[retainer.status]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-ink/70">{formatDate(retainer.startDate)}</td>
                    <td className="py-2.5 text-ink/70">{formatDate(retainer.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

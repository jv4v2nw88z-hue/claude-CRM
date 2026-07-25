import { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CalendarClock, DollarSign, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCompleteTask, useDashboardSummary, useTasks, useUpdateTask } from "../hooks/queries";
import { formatCurrency } from "../lib/format";
import { AtRiskPanel } from "../components/AtRiskPanel";
import { InteractionTimelineItem } from "../components/InteractionTimelineItem";
import { StatCard } from "../components/StatCard";
import { TaskChecklist } from "../components/TaskChecklist";
import { Card, EmptyState, ErrorNotice, SectionHeading, Skeleton } from "../components/ui";

/**
 * recharts is ~105 KB gzipped — more than the rest of this page put together,
 * for one chart that sits below the numbers everyone actually opens the
 * dashboard to read. Deferring it lets the MRR figure, the at-risk panel and
 * today's tasks paint without waiting on the charting library.
 */
const MRRTrendChart = lazy(() =>
  import("../components/MRRTrendChart").then((m) => ({ default: m.MRRTrendChart }))
);

export function Dashboard() {
  const { user } = useAuth();
  const summaryQuery = useDashboardSummary();
  // Brian's default view is his own build queue; Cole's is his sales queue.
  const tasksQuery = useTasks({ assignedToId: user?.id });
  const completeTask = useCompleteTask();
  const updateTask = useUpdateTask();

  const summary = summaryQuery.data;

  const handleSnooze = (taskId: string) => {
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + 7);
    updateTask.mutate({ id: taskId, data: { snoozedUntil: snoozedUntil.toISOString() } });
  };

  const mrrTrendDirection =
    summary && summary.mrrChangeVsLastMonth > 0
      ? ("up" as const)
      : summary && summary.mrrChangeVsLastMonth < 0
        ? ("down" as const)
        : ("flat" as const);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">
          {greeting()}{user ? `, ${user.name}` : ""}
        </h1>
        <p className="text-sm text-ink/70">Here's what needs attention today.</p>
      </div>

      {summaryQuery.isError && (
        <ErrorNotice
          message={(summaryQuery.error as Error).message}
          onRetry={() => summaryQuery.refetch()}
        />
      )}

      {/* Headline numbers. MRR first — it is the metric this business lives on. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[7.5rem]" />)
        ) : (
          <>
            <StatCard
              label="Total MRR"
              value={formatCurrency(summary?.totalMRR)}
              tone="success"
              icon={<DollarSign className="h-4 w-4" />}
              trend={{
                direction: mrrTrendDirection,
                label:
                  summary?.mrrChangeVsLastMonth === 0
                    ? "Flat vs last month"
                    : `${formatCurrency(Math.abs(summary?.mrrChangeVsLastMonth ?? 0))} vs last month`,
              }}
            />
            <StatCard
              label="Active Clients"
              value={String(summary?.activeClientCount ?? 0)}
              icon={<Users className="h-4 w-4" />}
              sublabel={`${summary?.clientsByTier.WEBSITE_LIVE ?? 0} at Website Live`}
            />
            <StatCard
              label="Overdue Tasks"
              value={String(summary?.overdueTasks ?? 0)}
              tone={(summary?.overdueTasks ?? 0) > 0 ? "danger" : "default"}
              icon={<AlertCircle className="h-4 w-4" />}
              sublabel={(summary?.overdueTasks ?? 0) > 0 ? "Clear these first" : "All caught up"}
            />
            <StatCard
              label="Due This Week"
              value={String(summary?.tasksThisWeek ?? 0)}
              icon={<CalendarClock className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      <AtRiskPanel atRisk={summary?.atRiskClients} isLoading={summaryQuery.isLoading} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionHeading
            title="My Tasks"
            description="Assigned to you, soonest first."
            action={
              <Link to="/tasks" className="text-xs font-medium text-accent hover:underline">
                View all tasks
              </Link>
            }
          />

          {tasksQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : tasksQuery.isError ? (
            <ErrorNotice
              message={(tasksQuery.error as Error).message}
              onRetry={() => tasksQuery.refetch()}
            />
          ) : (
            <TaskChecklist
              tasks={tasksQuery.data ?? []}
              onComplete={(id) => completeTask.mutate(id)}
              onSnooze={handleSnooze}
              emptyTitle="Inbox zero"
              emptyDescription="Nothing is assigned to you right now. Check the full task list if you want to pull work forward."
            />
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeading title="MRR Trend" description="Last 6 months" />
            {summaryQuery.isLoading ? (
              <Skeleton className="h-[220px]" />
            ) : (
              <Suspense fallback={<Skeleton className="h-[220px]" />}>
                <MRRTrendChart data={summary?.mrrTrend} />
              </Suspense>
            )}
          </Card>

          <Card className="p-5">
            <SectionHeading title="Recent Activity" description="Across all clients" />
            {summaryQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (summary?.recentActivity.length ?? 0) === 0 ? (
              <EmptyState
                title="No interactions logged yet"
                description="Log a call or email from any client page and it will show up here."
              />
            ) : (
              <ul>
                {summary?.recentActivity.map((item, index) => (
                  <InteractionTimelineItem
                    key={item.id}
                    type={item.type}
                    summary={item.summary}
                    occurredAt={item.occurredAt}
                    loggedBy={item.loggedBy}
                    clientName={item.businessName}
                    clientId={item.clientId}
                    isLast={index === summary.recentActivity.length - 1}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

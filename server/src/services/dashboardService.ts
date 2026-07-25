import type { PrismaClient } from "../generated/prisma/client";
import { OPEN_TASK_STATUSES } from "../domain/enums";
import { daysBetween, endOfWeek, startOfDay } from "../utils/dateHelpers";
import { activeMrr, hasActiveRetainer, mrrTrend, pendingMrr, toNumber } from "./retainerService";

/** A launched site with no retainer is the single biggest revenue leak in this business. */
export const AT_RISK_DAYS = 45;

export async function getDashboardSummary(prisma: PrismaClient, now = new Date()) {
  const [clients, allRetainers, recentInteractions] = await Promise.all([
    prisma.client.findMany({
      where: { isActive: true },
      include: { retainers: true },
    }),
    prisma.retainer.findMany({
      include: { client: { select: { id: true, businessName: true, isActive: true } } },
    }),
    prisma.interaction.findMany({
      take: 10,
      orderBy: { occurredAt: "desc" },
      include: {
        client: { select: { id: true, businessName: true } },
        loggedBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  const liveRetainers = allRetainers.filter((r) => r.client?.isActive !== false);

  const clientsByTier: Record<string, number> = {};
  for (const client of clients) {
    clientsByTier[client.currentTier] = (clientsByTier[client.currentTier] ?? 0) + 1;
  }

  const atRiskClients = clients
    .filter(
      (c) =>
        c.currentTier === "WEBSITE_LIVE" &&
        c.websiteLaunchDate !== null &&
        daysBetween(c.websiteLaunchDate, now) >= AT_RISK_DAYS &&
        !hasActiveRetainer(c.retainers)
    )
    .map((c) => ({
      clientId: c.id,
      businessName: c.businessName,
      daysSinceLaunch: daysBetween(c.websiteLaunchDate!, now),
      tier: c.currentTier,
    }))
    .sort((a, b) => b.daysSinceLaunch - a.daysSinceLaunch);

  const today = startOfDay(now);

  const [overdueTasks, tasksThisWeek] = await Promise.all([
    prisma.task.count({
      where: { status: { in: OPEN_TASK_STATUSES }, dueDate: { lt: today } },
    }),
    prisma.task.count({
      where: {
        status: { in: OPEN_TASK_STATUSES },
        dueDate: { gte: today, lte: endOfWeek(now) },
      },
    }),
  ]);

  const trend = mrrTrend(liveRetainers, 6, now);
  const totalMRR = activeMrr(liveRetainers);
  const previousMonthMrr = trend.length > 1 ? trend[trend.length - 2].mrr : 0;

  return {
    totalMRR: round(totalMRR),
    pendingMRR: round(pendingMrr(liveRetainers)),
    mrrChangeVsLastMonth: round(totalMRR - previousMonthMrr),
    activeClientCount: clients.filter(
      (c) => c.currentTier !== "PROSPECT" && c.currentTier !== "CHURNED"
    ).length,
    clientsByTier,
    overdueTasks,
    tasksThisWeek,
    atRiskClients,
    mrrTrend: trend,
    recentActivity: recentInteractions.map((i) => ({
      id: i.id,
      type: i.type,
      summary: i.summary,
      occurredAt: i.occurredAt,
      clientId: i.clientId,
      businessName: i.client.businessName,
      loggedBy: i.loggedBy?.name ?? null,
    })),
  };
}

export async function getRevenueSummary(prisma: PrismaClient, now = new Date()) {
  const retainers = await prisma.retainer.findMany({
    include: { client: { select: { id: true, businessName: true, isActive: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const live = retainers.filter((r) => r.client?.isActive !== false);
  const byTier: Record<string, number> = {};
  for (const r of live) {
    if (r.status !== "ACTIVE") continue;
    byTier[r.tier] = round((byTier[r.tier] ?? 0) + toNumber(r.monthlyAmount));
  }

  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const lostThisQuarter = live
    .filter((r) => r.status === "CANCELLED" && (r.endDate ?? r.updatedAt) >= quarterStart)
    .reduce((sum, r) => sum + toNumber(r.monthlyAmount), 0);

  return {
    retainers,
    totalActiveMRR: round(activeMrr(live)),
    pendingMRR: round(pendingMrr(live)),
    lostThisQuarter: round(lostThisQuarter),
    mrrByTier: byTier,
    mrrTrend: mrrTrend(live, 6, now),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

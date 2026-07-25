import { endOfMonth, lastNMonths, monthKey, startOfMonth } from "../utils/dateHelpers";
import type { RetainerStatus, ServiceTierType } from "../domain/enums";

export interface RetainerLike {
  monthlyAmount: number;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  tier: string;
  updatedAt: Date;
}

/**
 * Money is a SQLite REAL now rather than a Postgres NUMERIC, so this arrives as
 * a plain number and no longer needs Decimal unwrapping — but every amount still
 * goes through here so callers stay indifferent to how it is stored.
 */
export function toNumber(amount: number | string): number {
  return typeof amount === "number" ? amount : Number(amount);
}

/** MRR we can actually bank today: ACTIVE retainers only. */
export function activeMrr(retainers: RetainerLike[]): number {
  return retainers
    .filter((r) => r.status === "ACTIVE")
    .reduce((sum, r) => sum + toNumber(r.monthlyAmount), 0);
}

/** Signed but not yet collecting — worth surfacing separately so it never gets counted as real. */
export function pendingMrr(retainers: RetainerLike[]): number {
  return retainers
    .filter((r) => r.status === "PENDING_FIRST_PAYMENT")
    .reduce((sum, r) => sum + toNumber(r.monthlyAmount), 0);
}

export function mrrByTier(retainers: RetainerLike[]): Record<string, number> {
  const byTier: Record<string, number> = {};
  for (const r of retainers) {
    if (r.status !== "ACTIVE") continue;
    byTier[r.tier] = (byTier[r.tier] ?? 0) + toNumber(r.monthlyAmount);
  }
  return byTier;
}

export function hasActiveRetainer(retainers: { status: string }[]): boolean {
  return retainers.some((r) => r.status === "ACTIVE");
}

/**
 * Was this retainer billing during the given month?
 *
 * A retainer counts for a month when it had started by the end of it and hadn't
 * ended before it began. PENDING_FIRST_PAYMENT never counts — no money moved.
 * Cancelled/paused retainers with no endDate fall back to `updatedAt` as the
 * effective stop date, which is the best signal we have for when it lapsed.
 */
function wasBillingIn(retainer: RetainerLike, monthStart: Date, monthEnd: Date): boolean {
  if (retainer.status === "PENDING_FIRST_PAYMENT") return false;
  if (!retainer.startDate) return false;
  if (retainer.startDate > monthEnd) return false;

  const effectiveEnd =
    retainer.endDate ??
    (retainer.status === "CANCELLED" || retainer.status === "PAUSED" ? retainer.updatedAt : null);

  if (effectiveEnd && effectiveEnd < monthStart) return false;
  return true;
}

export interface MrrTrendPoint {
  month: string;
  mrr: number;
}

export function mrrTrend(retainers: RetainerLike[], months = 6, from = new Date()): MrrTrendPoint[] {
  return lastNMonths(months, from).map((m) => {
    const monthStart = startOfMonth(m);
    const monthEnd = endOfMonth(m);
    const mrr = retainers
      .filter((r) => wasBillingIn(r, monthStart, monthEnd))
      .reduce((sum, r) => sum + toNumber(r.monthlyAmount), 0);
    return { month: monthKey(m), mrr: Math.round(mrr * 100) / 100 };
  });
}

/** Revenue that walked out the door this quarter — the number that should sting. */
export function mrrLostThisQuarter(retainers: RetainerLike[], now = new Date()): number {
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  return retainers
    .filter((r) => {
      if (r.status !== "CANCELLED") return false;
      const lostAt = r.endDate ?? r.updatedAt;
      return lostAt >= quarterStart && lostAt <= now;
    })
    .reduce((sum, r) => sum + toNumber(r.monthlyAmount), 0);
}

export const ALL_RETAINER_STATUSES: RetainerStatus[] = [
  "ACTIVE",
  "PAUSED",
  "CANCELLED",
  "PENDING_FIRST_PAYMENT",
];

export type { ServiceTierType };
export { TIER_ORDER } from "../domain/enums";

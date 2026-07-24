import type { InteractionType, ServiceTierType, TaskType } from "../types";

export const TIER_LABELS: Record<ServiceTierType, string> = {
  PROSPECT: "Prospect",
  WEBSITE_BUILD: "Website Build",
  WEBSITE_LIVE: "Website Live",
  BRAND_CURATION: "Brand Curation",
  SOCIAL_MEDIA: "Social Media",
  ANALYTICS: "Analytics",
  CHURNED: "Churned",
};

/** The rungs of the ladder, in order. CHURNED sits outside it. */
export const LADDER_TIERS: ServiceTierType[] = [
  "PROSPECT",
  "WEBSITE_BUILD",
  "WEBSITE_LIVE",
  "BRAND_CURATION",
  "SOCIAL_MEDIA",
  "ANALYTICS",
];

export const ALL_TIERS: ServiceTierType[] = [...LADDER_TIERS, "CHURNED"];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  MANUAL: "Manual",
  AUTO_UPSELL_PITCH: "Upsell pitch",
  AUTO_CHECK_IN: "Check-in",
  AUTO_INVOICE_REMINDER: "Invoice reminder",
  AUTO_CONTRACT_RENEWAL: "Contract renewal",
  BUILD_MILESTONE: "Build milestone",
};

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  TEXT: "Text",
  SITE_VISIT: "Site visit",
  OTHER: "Other",
};

export function formatCurrency(value: number | null | undefined, withCents = false): string {
  const amount = value ?? 0;
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "3 days ago" / "in 2 days" — friendlier than a date for recency at a glance. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  const days = daysFromToday(date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `in ${days} days`;
}

/** Positive = future, negative = past, 0 = today. Compared at midnight. */
export function daysFromToday(value: string | Date): number {
  const date = typeof value === "string" ? new Date(value) : value;
  const a = new Date(date);
  a.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - today.getTime()) / 86_400_000);
}

export function isOverdue(dueDate: string | null | undefined): boolean {
  return dueDate ? daysFromToday(dueDate) < 0 : false;
}

/** "2026-07" -> "Jul" for chart axes. */
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** For <input type="date">, which only accepts yyyy-mm-dd. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

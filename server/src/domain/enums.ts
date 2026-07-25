/**
 * The enums that used to live in the Prisma schema.
 *
 * D1 is SQLite, which has no enum type, so these columns are plain strings in
 * the database. Keeping the allowed values here — as const objects plus derived
 * string-union types — preserves the exact same authoring experience the
 * generated Prisma enums gave us (`ServiceTierType.WEBSITE_LIVE`, exhaustive
 * `Record<ServiceTierType, …>` maps, no stringly-typed guesswork), and the Zod
 * schemas in `utils/validation.ts` enforce them on the way in.
 */

export const ServiceTierType = {
  PROSPECT: "PROSPECT",
  WEBSITE_BUILD: "WEBSITE_BUILD",
  WEBSITE_LIVE: "WEBSITE_LIVE",
  BRAND_CURATION: "BRAND_CURATION",
  SOCIAL_MEDIA: "SOCIAL_MEDIA",
  ANALYTICS: "ANALYTICS",
  CHURNED: "CHURNED",
} as const;
export type ServiceTierType = (typeof ServiceTierType)[keyof typeof ServiceTierType];

export const TaskStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  SNOOZED: "SNOOZED",
  CANCELLED: "CANCELLED",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskType = {
  MANUAL: "MANUAL",
  AUTO_UPSELL_PITCH: "AUTO_UPSELL_PITCH",
  AUTO_CHECK_IN: "AUTO_CHECK_IN",
  AUTO_INVOICE_REMINDER: "AUTO_INVOICE_REMINDER",
  AUTO_CONTRACT_RENEWAL: "AUTO_CONTRACT_RENEWAL",
  BUILD_MILESTONE: "BUILD_MILESTONE",
} as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];

export const InteractionType = {
  CALL: "CALL",
  EMAIL: "EMAIL",
  MEETING: "MEETING",
  TEXT: "TEXT",
  SITE_VISIT: "SITE_VISIT",
  OTHER: "OTHER",
} as const;
export type InteractionType = (typeof InteractionType)[keyof typeof InteractionType];

export const RetainerStatus = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  CANCELLED: "CANCELLED",
  PENDING_FIRST_PAYMENT: "PENDING_FIRST_PAYMENT",
} as const;
export type RetainerStatus = (typeof RetainerStatus)[keyof typeof RetainerStatus];

export const UserRole = {
  SALES: "SALES", // Cole
  TECHNICAL: "TECHNICAL", // Brian
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Which date an automation rule counts its days from.
 * TIER_CHANGE    -> websiteLaunchDate when the trigger tier is WEBSITE_LIVE, otherwise
 *                   the most recent ServiceHistoryEntry into the trigger tier.
 * RETAINER_START -> the start date of the client's active retainer (recurring rules).
 * RETAINER_END   -> a retainer's endDate; use a negative daysAfterTrigger to fire before it.
 */
export const RuleAnchor = {
  TIER_CHANGE: "TIER_CHANGE",
  RETAINER_START: "RETAINER_START",
  RETAINER_END: "RETAINER_END",
} as const;
export type RuleAnchor = (typeof RuleAnchor)[keyof typeof RuleAnchor];

/** Statuses that mean "this task still needs doing". */
export const OPEN_TASK_STATUSES: TaskStatus[] = ["OPEN", "IN_PROGRESS", "SNOOZED"];

export const TIER_ORDER: ServiceTierType[] = [
  "PROSPECT",
  "WEBSITE_BUILD",
  "WEBSITE_LIVE",
  "BRAND_CURATION",
  "SOCIAL_MEDIA",
  "ANALYTICS",
  "CHURNED",
];

export const TIER_LABELS: Record<ServiceTierType, string> = {
  PROSPECT: "Prospect",
  WEBSITE_BUILD: "Website Build",
  WEBSITE_LIVE: "Website Live",
  BRAND_CURATION: "Brand Curation",
  SOCIAL_MEDIA: "Social Media",
  ANALYTICS: "Analytics",
  CHURNED: "Churned",
};

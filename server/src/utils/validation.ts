import { z } from "zod";
import {
  InteractionType,
  RetainerStatus,
  RuleAnchor,
  ServiceTierType,
  TaskStatus,
  TaskType,
} from "../domain/enums";

/**
 * These lists are derived from `domain/enums.ts` rather than retyped, so the set
 * of values the API accepts can never drift from the set the app understands.
 * That matters more on D1 than it did on Postgres: SQLite has no enum type, so
 * these Zod schemas are the only thing standing between a typo and a row the
 * dashboard cannot classify.
 */
export const SERVICE_TIERS = Object.values(ServiceTierType) as [
  ServiceTierType,
  ...ServiceTierType[],
];
export const TASK_STATUSES = Object.values(TaskStatus) as [TaskStatus, ...TaskStatus[]];
export const TASK_TYPES = Object.values(TaskType) as [TaskType, ...TaskType[]];
export const INTERACTION_TYPES = Object.values(InteractionType) as [
  InteractionType,
  ...InteractionType[],
];
export const RETAINER_STATUSES = Object.values(RetainerStatus) as [
  RetainerStatus,
  ...RetainerStatus[],
];
export const RULE_ANCHORS = Object.values(RuleAnchor) as [RuleAnchor, ...RuleAnchor[]];

/**
 * The stages the database is seeded with.
 *
 * No longer a validation enum — stages are rows and a deal's stage is checked by
 * foreign key, not by matching this list. It survives as the seed's starting set
 * and as the names migration 0006 assigns fixed ids to. Validating against it
 * would defeat the entire feature.
 */
export const DEFAULT_PIPELINE_STAGES = [
  { id: "stage_new", name: "New", order: 100, isWon: false, isLost: false },
  { id: "stage_contacted", name: "Contacted", order: 200, isWon: false, isLost: false },
  { id: "stage_quoted", name: "Quoted", order: 300, isWon: false, isLost: false },
  { id: "stage_won", name: "Won", order: 400, isWon: true, isLost: false },
  { id: "stage_lost", name: "Lost", order: 500, isWon: false, isLost: true },
] as const;

export const tierEnum = z.enum(SERVICE_TIERS);

/** Accepts "", null, or a real value — the forms send empty strings for untouched fields. */
const optionalString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v === "" ? null : v));

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || v === undefined || /^https?:\/\/.+/.test(v), {
    message: "Must be a URL starting with http:// or https://",
  });

const optionalDate = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

const money = z.coerce.number().nonnegative().max(1_000_000);

// ---------------------------
// Auth
// ---------------------------

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Minimum length is the only strength rule.
 *
 * Composition requirements (a digit, a symbol, mixed case) reliably push people
 * towards `Password1!` and no further; length is the property that actually
 * costs an attacker anything. Twelve is the audit's figure and NIST's floor for
 * a secret with no other factor behind it.
 */
export const PASSWORD_MIN_LENGTH = 12;

/** Granting a collaborator write access to a client. */
export const grantAccessSchema = z.object({
  userId: z.string().min(1, "Pick a user"),
});

/** Reassigning the primary owner. TECHNICAL-only, enforced at the route. */
export const transferOwnershipSchema = z.object({
  accountOwnerId: z.string().min(1, "Pick an owner"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`),
});

// ---------------------------
// Clients
// ---------------------------

export const createClientSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required"),
  industry: optionalString,
  websiteUrl: optionalUrl,
  address: optionalString,
  city: optionalString,
  state: optionalString,
  zip: optionalString,
  currentTier: tierEnum.optional(),
  accountOwnerId: optionalString,
  websiteLaunchDate: optionalDate,
  notes: optionalString,
  logoUrl: optionalUrl,
});

export const updateClientSchema = createClientSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const changeTierSchema = z.object({
  newTier: tierEnum,
  note: optionalString,
});

// ---------------------------
// Contacts
// ---------------------------

export const createContactSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  title: optionalString,
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || v === undefined || z.string().email().safeParse(v).success, {
      message: "Invalid email",
    }),
  phone: optionalString,
  isPrimary: z.boolean().optional(),
});

export const updateContactSchema = createContactSchema.partial();

// ---------------------------
// Retainers
// ---------------------------

export const createRetainerSchema = z.object({
  tier: tierEnum,
  monthlyAmount: money,
  status: z.enum(RETAINER_STATUSES).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  billingDay: z.coerce.number().int().min(1).max(28).optional().nullable(),
  notes: optionalString,
});

export const updateRetainerSchema = createRetainerSchema.partial();

// ---------------------------
// Tasks
// ---------------------------

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: optionalString,
  clientId: optionalString,
  type: z.enum(TASK_TYPES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  dueDate: optionalDate,
  assignedToId: optionalString,
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  snoozedUntil: optionalDate,
});

// ---------------------------
// Interactions
// ---------------------------

export const createInteractionSchema = z.object({
  type: z.enum(INTERACTION_TYPES),
  summary: z.string().trim().min(1, "Summary is required"),
  occurredAt: optionalDate,
});

// ---------------------------
// Deals
// ---------------------------

export const createDealSchema = z.object({
  businessName: z.string().trim().min(1),
  contactName: optionalString,
  contactEmail: optionalString,
  contactPhone: optionalString,
  source: optionalString,
  // Optional on create: omitting it drops the deal in the first column, which is
  // what "new lead" means. The value is checked against the table, not a list.
  stageId: z.string().trim().min(1).optional(),
  estimatedValue: money.optional().nullable(),
  notes: optionalString,
  lostReason: optionalString,
});

export const updateDealSchema = createDealSchema.partial();

// ---------------------------
// Pipeline stages
// ---------------------------

export const createPipelineStageSchema = z.object({
  name: z.string().trim().min(1).max(40),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
});

/// Name is optional here so a rename and a flag toggle are separate edits.
export const updatePipelineStageSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
});

/// Reorder takes the whole board at once. Sending the full ordering rather than
/// one stage's new index means the result can't depend on which order a series
/// of single-stage writes happened to land in.
export const reorderPipelineStagesSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1),
});

/// Deleting a stage that still holds deals needs somewhere to put them.
export const deletePipelineStageSchema = z.object({
  reassignToId: z.string().trim().min(1).optional(),
});

export const convertDealSchema = z.object({
  accountOwnerId: optionalString,
  currentTier: tierEnum.optional(),
  industry: optionalString,
});

// ---------------------------
// Documents
// ---------------------------

/** The upload is one multipart request now, so only the metadata needs checking. */
export const uploadDocumentSchema = z.object({
  category: optionalString,
});

// ---------------------------
// Automation rules
// ---------------------------

export const createAutomationRuleSchema = z.object({
  name: z.string().trim().min(1),
  triggerTier: tierEnum.optional().nullable(),
  anchor: z.enum(RULE_ANCHORS).optional(),
  daysAfterTrigger: z.coerce.number().int().min(-365).max(3650),
  repeatEveryDays: z.coerce.number().int().min(1).max(3650).optional().nullable(),
  requiresActiveRetainer: z.boolean().optional(),
  taskTitleTemplate: z.string().trim().min(1),
  taskType: z.enum(TASK_TYPES).optional(),
  isActive: z.boolean().optional(),
});

export const updateAutomationRuleSchema = createAutomationRuleSchema.partial();

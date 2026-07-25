import type { PrismaClient } from "../generated/prisma/client";

/**
 * Field-level change logging.
 *
 * Tier moves already had `ServiceHistoryEntry`; nothing recorded a deal's value
 * being edited or a retainer's amount changed. That is the gap that matters —
 * those are the fields carrying money, and a silent edit to one is invisible six
 * months later when it is disputed.
 *
 * Kept generic on purpose. Adding a field to the watch list is a change at the
 * call site, not a migration and not a new column.
 */

/** Only `Deal` and `Retainer` are watched today; the table holds any entity. */
export type AuditEntity = "Deal" | "Retainer" | "Client";

/**
 * Stringify for the log.
 *
 * The log records what a person would have seen, not a value to compute from,
 * so everything becomes a string. Dates go to ISO rather than `toString()` so
 * they stay sortable and unambiguous, and null stays null rather than becoming
 * the word "null" — a field that was genuinely empty should read as empty.
 */
function display(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Writes one row per field that actually changed.
 *
 * Compares stringified values, so a no-op update — the same amount submitted
 * twice, which the UI does on any form resubmit — writes nothing. An audit log
 * full of "changed 600 to 600" is one nobody reads.
 *
 * Never throws. A failure to record history must not fail the write it is
 * describing: losing the log entry is bad, losing the user's edit because the
 * log failed is worse. D1 has no transactions here anyway, so the two were never
 * going to be atomic — this makes the ordering explicit rather than accidental.
 */
export async function logFieldChanges(
  prisma: PrismaClient,
  entity: AuditEntity,
  entityId: string,
  changedById: string | null,
  changes: FieldChange[]
): Promise<void> {
  const rows = changes
    .map((c) => ({
      entity,
      entityId,
      field: c.field,
      oldValue: display(c.oldValue),
      newValue: display(c.newValue),
      changedById,
    }))
    .filter((r) => r.oldValue !== r.newValue);

  if (rows.length === 0) return;

  try {
    await prisma.auditLog.createMany({ data: rows });
  } catch (err) {
    console.error(`Audit log write failed for ${entity}:${entityId}`, err);
  }
}

/**
 * Builds the change list for the fields being watched on a record.
 *
 * `before` and `after` are the whole rows; this picks out the watched fields and
 * ignores everything else, so a route can hand over its update payload without
 * having to know which fields are audited.
 */
export function diffWatchedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  watched: readonly (keyof T & string)[]
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of watched) {
    if (!(field in after)) continue;
    changes.push({ field, oldValue: before[field], newValue: after[field] });
  }
  return changes;
}

/** The money-carrying fields. Extend these lists to watch more. */
export const WATCHED_DEAL_FIELDS = ["estimatedValue", "stage"] as const;
export const WATCHED_RETAINER_FIELDS = ["monthlyAmount", "status"] as const;

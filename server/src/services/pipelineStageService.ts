import { HttpError } from "../lib/http";
import type { PrismaClient } from "../generated/prisma/client";

/**
 * Pipeline stage rules.
 *
 * Kept out of the route handlers because every one of these is an invariant the
 * rest of the app quietly assumes: the board is never empty, exactly one stage
 * means "won", and no deal ever points at a stage that isn't there.
 */

/** Board order, left to right. */
export const STAGE_ORDER_STEP = 100;

/**
 * The stage a deal lands in when none is given.
 *
 * Lowest `order` rather than a hard-coded "New", because the first column is
 * whatever the board says it is after someone reorders it.
 */
export async function defaultStage(prisma: PrismaClient) {
  const stage = await prisma.pipelineStage.findFirst({ orderBy: { order: "asc" } });
  if (!stage) {
    // Only reachable if every stage was deleted, which deleteStage prevents.
    throw new HttpError(500, "The pipeline has no stages configured.");
  }
  return stage;
}

/** The stage marked as the won outcome, if the board still has one. */
export function wonStage(prisma: PrismaClient) {
  return prisma.pipelineStage.findFirst({ where: { isWon: true }, orderBy: { order: "asc" } });
}

/**
 * Resolve a caller-supplied stage id, or fall back to the first column.
 *
 * A 400 rather than a foreign-key error: "that stage doesn't exist" is a client
 * mistake and should read like one, and it also stops a bad id reaching the FK
 * where D1 would surface it as an opaque constraint failure.
 */
export async function resolveStage(prisma: PrismaClient, stageId: string | undefined) {
  if (!stageId) return defaultStage(prisma);
  const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
  if (!stage) throw new HttpError(400, "That pipeline stage no longer exists.");
  return stage;
}

/**
 * `isWon` and `isLost` are mutually exclusive, and at most one stage holds each.
 *
 * Clearing the flag from whichever stage held it before is what makes "mark this
 * column as Won" behave the way the UI implies — moving the flag, not adding a
 * second one. Two stages claiming `isWon` would make the conversion prompt fire
 * on whichever the query happened to return first.
 */
export async function applyOutcomeFlags(
  prisma: PrismaClient,
  stageId: string,
  isWon: boolean,
  isLost: boolean
) {
  if (isWon && isLost) {
    throw new HttpError(400, "A stage can be the won outcome or the lost one, not both.");
  }
  // Demote the previous holder first. If the second write fails the board is
  // briefly missing a won stage, which degrades to "no conversion prompt" —
  // recoverable and visible. The reverse order could leave two winners.
  if (isWon) {
    await prisma.pipelineStage.updateMany({
      where: { isWon: true, id: { not: stageId } },
      data: { isWon: false },
    });
  }
  if (isLost) {
    await prisma.pipelineStage.updateMany({
      where: { isLost: true, id: { not: stageId } },
      data: { isLost: false },
    });
  }
}

export interface DeleteStageOptions {
  reassignToId?: string;
}

/**
 * Delete a stage, refusing when that would lose data or empty the board.
 *
 * The guard is the feature. A stage holding deals can only go if the caller says
 * where those deals should land, and the last stage can never go at all — a
 * pipeline with no columns has nowhere to put a new deal, and every subsequent
 * create would fail on the NOT NULL stageId.
 */
export async function deleteStage(
  prisma: PrismaClient,
  stageId: string,
  { reassignToId }: DeleteStageOptions = {}
) {
  const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
  if (!stage) throw new HttpError(404, "Stage not found");

  const remaining = await prisma.pipelineStage.count({ where: { id: { not: stageId } } });
  if (remaining === 0) {
    throw new HttpError(409, "This is the last stage. A pipeline needs at least one column.");
  }

  const dealCount = await prisma.deal.count({ where: { stageId } });
  if (dealCount > 0) {
    if (!reassignToId) {
      throw new HttpError(
        409,
        `"${stage.name}" still has ${dealCount} deal${dealCount === 1 ? "" : "s"} in it. ` +
          `Choose a stage to move ${dealCount === 1 ? "it" : "them"} to first.`
      );
    }
    if (reassignToId === stageId) {
      throw new HttpError(400, "Deals can't be moved into the stage being deleted.");
    }
    const target = await prisma.pipelineStage.findUnique({ where: { id: reassignToId } });
    if (!target) throw new HttpError(400, "The stage you picked to move deals into doesn't exist.");

    // Move the deals before dropping the stage. The FK is RESTRICT, so the
    // delete below simply fails if this did not land — the deals are never
    // orphaned and the operator sees the stage still standing.
    await prisma.deal.updateMany({ where: { stageId }, data: { stageId: reassignToId } });
  }

  // History rows keep their name snapshots and have their FK nulled by
  // ON DELETE SET NULL, so the timeline survives the column disappearing.
  await prisma.pipelineStage.delete({ where: { id: stageId } });
  return { movedDeals: dealCount };
}

import type { PrismaClient } from "../generated/prisma/client";

interface StageRef {
  id: string;
  name: string;
}

/**
 * Record one stage transition.
 *
 * Names are snapshotted alongside the foreign keys so the timeline still reads
 * correctly after a stage is renamed or deleted — see the DealStageEntry comment
 * in schema.prisma.
 *
 * Never throws. Like the audit log, this runs after the write it describes: a
 * deal that moved without its history entry loses a line of provenance, but a
 * history entry that blocks the move would make the board unusable because
 * bookkeeping failed. D1 has no transactions to make the pair atomic, so the
 * failure mode is chosen rather than avoided.
 */
export async function logStageChange(
  prisma: PrismaClient,
  dealId: string,
  from: StageRef | null,
  to: StageRef,
  changedById: string | null,
  note?: string
): Promise<void> {
  try {
    await prisma.dealStageEntry.create({
      data: {
        dealId,
        fromStageId: from?.id ?? null,
        fromStageName: from?.name ?? null,
        toStageId: to.id,
        toStageName: to.name,
        changedById,
        note: note ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to record deal stage change:", err);
  }
}

/** Newest first, bounded — this is a sidebar timeline, not an export. */
export function stageHistory(prisma: PrismaClient, dealId: string) {
  return prisma.dealStageEntry.findMany({
    where: { dealId },
    include: { changedBy: { select: { id: true, name: true } } },
    orderBy: { changedAt: "desc" },
    take: 100,
  });
}

import { Hono } from "hono";
import { HttpError } from "../lib/http";
import { requireRole } from "../middleware/requireRole";
import {
  applyOutcomeFlags,
  deleteStage,
  STAGE_ORDER_STEP,
} from "../services/pipelineStageService";
import {
  createPipelineStageSchema,
  deletePipelineStageSchema,
  reorderPipelineStagesSchema,
  updatePipelineStageSchema,
} from "../utils/validation";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

/**
 * Reading the board is open to everyone — Cole has to see the columns to drag a
 * deal across them. Changing its shape is TECHNICAL, because renaming or
 * deleting a stage rewrites how every deal in the system reads.
 */
router.get("/", async (c) => {
  const stages = await c.get("prisma").pipelineStage.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { deals: true } } },
  });
  return c.json(stages);
});

router.post("/", requireRole("TECHNICAL"), async (c) => {
  const parsed = createPipelineStageSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prisma = c.get("prisma");
  const { name, isWon = false, isLost = false } = parsed.data;

  const clash = await prisma.pipelineStage.findUnique({ where: { name } });
  if (clash) throw new HttpError(409, `There's already a stage called "${name}".`);

  // New columns go on the end of the board.
  const last = await prisma.pipelineStage.findFirst({ orderBy: { order: "desc" } });
  const stage = await prisma.pipelineStage.create({
    data: {
      name,
      order: (last?.order ?? 0) + STAGE_ORDER_STEP,
      isWon,
      isLost,
    },
  });

  // After the insert: applyOutcomeFlags clears the flag from other rows, and
  // doing that before this row exists would leave the board with no won stage
  // if the create then failed.
  if (isWon || isLost) await applyOutcomeFlags(prisma, stage.id, isWon, isLost);

  return c.json(await prisma.pipelineStage.findUnique({ where: { id: stage.id } }), 201);
});

/*
 * Reorder is mounted before /:id so "reorder" is never read as a stage id.
 */
router.patch("/reorder", requireRole("TECHNICAL"), async (c) => {
  const parsed = reorderPipelineStagesSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prisma = c.get("prisma");
  const { ids } = parsed.data;

  const known = await prisma.pipelineStage.findMany({ select: { id: true } });
  const knownIds = new Set(known.map((s) => s.id));
  const unknown = ids.filter((id) => !knownIds.has(id));
  if (unknown.length > 0) throw new HttpError(400, "That ordering names a stage that doesn't exist.");

  // Sequential rather than a transaction — D1 has none. A partial application
  // leaves the board in a different but still valid order, never a broken one,
  // because `order` carries no meaning beyond the sort.
  for (const [index, id] of ids.entries()) {
    await prisma.pipelineStage.update({
      where: { id },
      data: { order: (index + 1) * STAGE_ORDER_STEP },
    });
  }

  return c.json(await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }));
});

router.patch("/:id", requireRole("TECHNICAL"), async (c) => {
  const parsed = updatePipelineStageSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prisma = c.get("prisma");
  const id = c.req.param("id");

  const existing = await prisma.pipelineStage.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Stage not found");

  const { name, isWon, isLost } = parsed.data;

  if (name && name !== existing.name) {
    const clash = await prisma.pipelineStage.findUnique({ where: { name } });
    if (clash) throw new HttpError(409, `There's already a stage called "${name}".`);
  }

  const nextWon = isWon ?? existing.isWon;
  const nextLost = isLost ?? existing.isLost;
  await applyOutcomeFlags(prisma, id, nextWon, nextLost);

  const stage = await prisma.pipelineStage.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(isWon === undefined ? {} : { isWon }),
      ...(isLost === undefined ? {} : { isLost }),
    },
  });

  return c.json(stage);
});

router.delete("/:id", requireRole("TECHNICAL"), async (c) => {
  const parsed = deletePipelineStageSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const result = await deleteStage(c.get("prisma"), c.req.param("id"), {
    reassignToId: parsed.data.reassignToId,
  });
  return c.json(result);
});

export default router;

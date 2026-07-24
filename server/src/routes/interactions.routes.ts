import { Router } from "express";
import { prisma } from "../config/db";
import { asyncHandler } from "../middleware/errorHandler";
import { createInteractionSchema } from "../utils/validation";

/** Mounted at /api/clients/:clientId/interactions */
export const clientInteractionsRouter = Router({ mergeParams: true });

clientInteractionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const interactions = await prisma.interaction.findMany({
      where: { clientId: req.params.clientId },
      include: { loggedBy: { select: { id: true, name: true } } },
      orderBy: { occurredAt: "desc" },
    });
    res.json(interactions);
  })
);

clientInteractionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createInteractionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const interaction = await prisma.interaction.create({
      data: {
        clientId: req.params.clientId,
        type: parsed.data.type,
        summary: parsed.data.summary,
        occurredAt: parsed.data.occurredAt ?? new Date(),
        loggedById: req.user?.id ?? null,
      },
      include: { loggedBy: { select: { id: true, name: true } } },
    });
    res.status(201).json(interaction);
  })
);

/** Mounted at /api/interactions — the cross-client activity feed. */
export const interactionsRouter = Router();

interactionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const take = Math.min(Number(req.query.limit ?? 20) || 20, 100);
    const interactions = await prisma.interaction.findMany({
      take,
      include: {
        loggedBy: { select: { id: true, name: true } },
        client: { select: { id: true, businessName: true } },
      },
      orderBy: { occurredAt: "desc" },
    });
    res.json(interactions);
  })
);

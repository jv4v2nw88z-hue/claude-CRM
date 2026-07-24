import { Router } from "express";
import { prisma } from "../config/db";
import { asyncHandler } from "../middleware/errorHandler";
import { createRetainerSchema, updateRetainerSchema } from "../utils/validation";

/** Mounted at /api/retainers */
export const retainersRouter = Router();

retainersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const retainers = await prisma.retainer.findMany({
      include: { client: { select: { id: true, businessName: true, isActive: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    res.json(retainers);
  })
);

retainersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateRetainerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const data = { ...parsed.data };
    // Activating a retainer with no start date would leave it out of the MRR
    // trend entirely, so stamp today the moment money starts.
    if (data.status === "ACTIVE" && !data.startDate) {
      const existing = await prisma.retainer.findUniqueOrThrow({ where: { id: req.params.id } });
      if (!existing.startDate) data.startDate = new Date();
    }

    const retainer = await prisma.retainer.update({ where: { id: req.params.id }, data });
    res.json(retainer);
  })
);

retainersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.retainer.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

/** Mounted at /api/clients/:clientId/retainers */
export const clientRetainersRouter = Router({ mergeParams: true });

clientRetainersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const retainers = await prisma.retainer.findMany({
      where: { clientId: req.params.clientId },
      orderBy: { createdAt: "desc" },
    });
    res.json(retainers);
  })
);

clientRetainersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createRetainerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const status = parsed.data.status ?? "PENDING_FIRST_PAYMENT";
    const retainer = await prisma.retainer.create({
      data: {
        ...parsed.data,
        status,
        startDate: parsed.data.startDate ?? (status === "ACTIVE" ? new Date() : null),
        clientId: req.params.clientId,
      },
    });
    res.status(201).json(retainer);
  })
);

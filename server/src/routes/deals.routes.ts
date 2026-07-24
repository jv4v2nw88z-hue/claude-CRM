import { Router } from "express";
import { prisma } from "../config/db";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import { convertDealSchema, createDealSchema, updateDealSchema } from "../utils/validation";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const deals = await prisma.deal.findMany({
      include: { client: { select: { id: true, businessName: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(deals);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createDealSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const deal = await prisma.deal.create({ data: parsed.data });
    res.status(201).json(deal);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateDealSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const existing = await prisma.deal.findUniqueOrThrow({ where: { id: req.params.id } });
    const stageChanged = parsed.data.stage && parsed.data.stage !== existing.stage;

    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        // Powers the "days in current stage" counter on the kanban card.
        ...(stageChanged ? { stageChangedAt: new Date() } : {}),
      },
    });
    res.json(deal);
  })
);

router.post(
  "/:id/convert",
  asyncHandler(async (req, res) => {
    const parsed = convertDealSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: req.params.id } });
    if (deal.clientId) throw new HttpError(409, "This deal has already been converted");

    const tier = parsed.data.currentTier ?? "WEBSITE_BUILD";
    const userId = req.user?.id ?? null;

    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          businessName: deal.businessName,
          industry: parsed.data.industry ?? null,
          currentTier: tier,
          accountOwnerId: parsed.data.accountOwnerId ?? userId,
          notes: deal.notes,
          websiteLaunchDate: tier === "WEBSITE_LIVE" ? new Date() : null,
          serviceHistory: {
            create: { toTier: tier, changedById: userId, note: `Converted from deal "${deal.businessName}"` },
          },
          // Carry the deal's contact across so nobody has to retype it.
          ...(deal.contactName
            ? {
                contacts: {
                  create: {
                    firstName: deal.contactName.split(" ")[0] || deal.contactName,
                    lastName: deal.contactName.split(" ").slice(1).join(" ") || "—",
                    email: deal.contactEmail,
                    phone: deal.contactPhone,
                    isPrimary: true,
                  },
                },
              }
            : {}),
        },
      });

      await tx.deal.update({
        where: { id: deal.id },
        data: { clientId: created.id, stage: "Won", stageChangedAt: new Date() },
      });

      return created;
    });

    res.status(201).json(client);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.deal.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;

import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import { CLIENT_DETAIL_INCLUDE, updateClientTier } from "../services/clientService";
import { activeMrr } from "../services/retainerService";
import { AT_RISK_DAYS } from "../services/dashboardService";
import { daysBetween } from "../utils/dateHelpers";
import {
  changeTierSchema,
  createClientSchema,
  updateClientSchema,
} from "../utils/validation";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { tier, search, ownerId, atRisk } = req.query;

    const where: Prisma.ClientWhereInput = { isActive: true };
    if (tier) where.currentTier = { in: String(tier).split(",") as never };
    if (ownerId) where.accountOwnerId = String(ownerId);
    if (search) where.businessName = { contains: String(search), mode: "insensitive" };

    const clients = await prisma.client.findMany({
      where,
      include: {
        retainers: true,
        contacts: { where: { isPrimary: true }, take: 1 },
        accountOwner: { select: { id: true, name: true, role: true } },
        interactions: { orderBy: { occurredAt: "desc" }, take: 1 },
        tasks: {
          where: { status: { in: ["OPEN", "IN_PROGRESS", "SNOOZED"] } },
          orderBy: { dueDate: "asc" },
          take: 1,
        },
      },
      orderBy: { businessName: "asc" },
    });

    const now = new Date();
    const decorated = clients.map((c) => {
      const daysSinceLaunch = c.websiteLaunchDate ? daysBetween(c.websiteLaunchDate, now) : null;
      return {
        ...c,
        mrr: activeMrr(c.retainers),
        lastInteractionAt: c.interactions[0]?.occurredAt ?? null,
        nextTask: c.tasks[0] ?? null,
        primaryContact: c.contacts[0] ?? null,
        daysSinceLaunch,
        isAtRisk:
          c.currentTier === "WEBSITE_LIVE" &&
          daysSinceLaunch !== null &&
          daysSinceLaunch >= AT_RISK_DAYS &&
          !c.retainers.some((r) => r.status === "ACTIVE"),
      };
    });

    res.json(atRisk === "true" ? decorated.filter((c) => c.isAtRisk) : decorated);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: CLIENT_DETAIL_INCLUDE,
    });
    if (!client) throw new HttpError(404, "Client not found");

    const daysSinceLaunch = client.websiteLaunchDate
      ? daysBetween(client.websiteLaunchDate, new Date())
      : null;

    res.json({
      ...client,
      mrr: activeMrr(client.retainers),
      daysSinceLaunch,
      isAtRisk:
        client.currentTier === "WEBSITE_LIVE" &&
        daysSinceLaunch !== null &&
        daysSinceLaunch >= AT_RISK_DAYS &&
        !client.retainers.some((r) => r.status === "ACTIVE"),
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { currentTier, ...rest } = parsed.data;
    const tier = currentTier ?? "PROSPECT";

    const client = await prisma.client.create({
      data: {
        ...rest,
        currentTier: tier,
        // A client created directly at WEBSITE_LIVE still needs a launch date,
        // otherwise the at-risk timer never starts.
        websiteLaunchDate:
          rest.websiteLaunchDate ?? (tier === "WEBSITE_LIVE" ? new Date() : null),
        serviceHistory: {
          create: { toTier: tier, changedById: req.user?.id ?? null, note: "Client created" },
        },
      },
      include: { retainers: true },
    });

    res.status(201).json({ ...client, mrr: 0 });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    // Tier changes have side effects (history, timers) and must go through /tier.
    const { ...data } = parsed.data;
    delete (data as Record<string, unknown>).currentTier;

    const updated = await prisma.client.update({
      where: { id: req.params.id },
      data,
      include: { retainers: true },
    });
    res.json({ ...updated, mrr: activeMrr(updated.retainers) });
  })
);

router.patch(
  "/:id/tier",
  asyncHandler(async (req, res) => {
    const parsed = changeTierSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const updated = await updateClientTier(
      req.params.id,
      parsed.data.newTier,
      req.user?.id ?? null,
      parsed.data.note
    );
    res.json(updated);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    // Soft delete: this is the only record of the relationship, never drop the row.
    await prisma.client.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).send();
  })
);

export default router;

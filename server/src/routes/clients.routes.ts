import { Hono } from "hono";
import { HttpError } from "../lib/http";
import { CLIENT_DETAIL_INCLUDE, updateClientTier } from "../services/clientService";
import { activeMrr } from "../services/retainerService";
import { AT_RISK_DAYS } from "../services/dashboardService";
import { OPEN_TASK_STATUSES } from "../domain/enums";
import { daysBetween } from "../utils/dateHelpers";
import { changeTierSchema, createClientSchema, updateClientSchema } from "../utils/validation";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

router.get("/", async (c) => {
  const prisma = c.get("prisma");
  const { tier, search, ownerId, atRisk } = c.req.query();

  const where: Record<string, unknown> = { isActive: true };
  if (tier) where.currentTier = { in: tier.split(",") };
  if (ownerId) where.accountOwnerId = ownerId;
  // SQLite's LIKE is case-insensitive for ASCII by default, so the `mode:
  // "insensitive"` the Postgres version needed is both unnecessary and
  // unsupported here — `contains` alone already matches case-insensitively.
  if (search) where.businessName = { contains: search };

  const clients = await prisma.client.findMany({
    where,
    include: {
      retainers: true,
      contacts: { where: { isPrimary: true }, take: 1 },
      accountOwner: { select: { id: true, name: true, role: true } },
      interactions: { orderBy: { occurredAt: "desc" }, take: 1 },
      tasks: {
        where: { status: { in: OPEN_TASK_STATUSES } },
        orderBy: { dueDate: "asc" },
        take: 1,
      },
    },
    orderBy: { businessName: "asc" },
  });

  const now = new Date();
  const decorated = clients.map((client) => {
    const daysSinceLaunch = client.websiteLaunchDate
      ? daysBetween(client.websiteLaunchDate, now)
      : null;
    return {
      ...client,
      mrr: activeMrr(client.retainers),
      lastInteractionAt: client.interactions[0]?.occurredAt ?? null,
      nextTask: client.tasks[0] ?? null,
      primaryContact: client.contacts[0] ?? null,
      daysSinceLaunch,
      isAtRisk:
        client.currentTier === "WEBSITE_LIVE" &&
        daysSinceLaunch !== null &&
        daysSinceLaunch >= AT_RISK_DAYS &&
        !client.retainers.some((r) => r.status === "ACTIVE"),
    };
  });

  return c.json(atRisk === "true" ? decorated.filter((client) => client.isAtRisk) : decorated);
});

router.get("/:id", async (c) => {
  const client = await c.get("prisma").client.findUnique({
    where: { id: c.req.param("id") },
    include: CLIENT_DETAIL_INCLUDE,
  });
  if (!client) throw new HttpError(404, "Client not found");

  const daysSinceLaunch = client.websiteLaunchDate
    ? daysBetween(client.websiteLaunchDate, new Date())
    : null;

  return c.json({
    ...client,
    mrr: activeMrr(client.retainers),
    daysSinceLaunch,
    isAtRisk:
      client.currentTier === "WEBSITE_LIVE" &&
      daysSinceLaunch !== null &&
      daysSinceLaunch >= AT_RISK_DAYS &&
      !client.retainers.some((r) => r.status === "ACTIVE"),
  });
});

router.post("/", async (c) => {
  const parsed = createClientSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { currentTier, ...rest } = parsed.data;
  const tier = currentTier ?? "PROSPECT";

  const client = await c.get("prisma").client.create({
    data: {
      ...rest,
      currentTier: tier,
      // A client created directly at WEBSITE_LIVE still needs a launch date,
      // otherwise the at-risk timer never starts.
      websiteLaunchDate: rest.websiteLaunchDate ?? (tier === "WEBSITE_LIVE" ? new Date() : null),
      serviceHistory: {
        create: {
          toTier: tier,
          changedById: c.get("user")?.id ?? null,
          note: "Client created",
        },
      },
    },
    include: { retainers: true },
  });

  return c.json({ ...client, mrr: 0 }, 201);
});

router.patch("/:id", async (c) => {
  const parsed = updateClientSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  // Tier changes have side effects (history, timers) and must go through /tier.
  const data: Record<string, unknown> = { ...parsed.data };
  delete data.currentTier;

  const updated = await c.get("prisma").client.update({
    where: { id: c.req.param("id") },
    data,
    include: { retainers: true },
  });
  return c.json({ ...updated, mrr: activeMrr(updated.retainers) });
});

router.patch("/:id/tier", async (c) => {
  const parsed = changeTierSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const updated = await updateClientTier(
    c.get("prisma"),
    c.req.param("id"),
    parsed.data.newTier,
    c.get("user")?.id ?? null,
    parsed.data.note
  );
  return c.json(updated);
});

router.delete("/:id", async (c) => {
  // Soft delete: this is the only record of the relationship, never drop the row.
  await c
    .get("prisma")
    .client.update({ where: { id: c.req.param("id") }, data: { isActive: false } });
  return c.body(null, 204);
});

export default router;

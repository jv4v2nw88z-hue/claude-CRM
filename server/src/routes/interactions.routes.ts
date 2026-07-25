import { Hono } from "hono";
import { requireParam } from "../lib/http";
import { createInteractionSchema } from "../utils/validation";
import type { AppEnv } from "../types";

/** Mounted at /api/clients/:clientId/interactions */
export const clientInteractionsRouter = new Hono<AppEnv>();

clientInteractionsRouter.get("/", async (c) => {
  const interactions = await c.get("prisma").interaction.findMany({
    where: { clientId: requireParam(c, "clientId") },
    include: { loggedBy: { select: { id: true, name: true } } },
    orderBy: { occurredAt: "desc" },
  });
  return c.json(interactions);
});

clientInteractionsRouter.post("/", async (c) => {
  const parsed = createInteractionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const interaction = await c.get("prisma").interaction.create({
    data: {
      clientId: requireParam(c, "clientId"),
      type: parsed.data.type,
      summary: parsed.data.summary,
      occurredAt: parsed.data.occurredAt ?? new Date(),
      loggedById: c.get("user")?.id ?? null,
    },
    include: { loggedBy: { select: { id: true, name: true } } },
  });
  return c.json(interaction, 201);
});

/** Mounted at /api/interactions — the cross-client activity feed. */
export const interactionsRouter = new Hono<AppEnv>();

interactionsRouter.get("/", async (c) => {
  const take = Math.min(Number(c.req.query("limit") ?? 20) || 20, 100);
  const interactions = await c.get("prisma").interaction.findMany({
    take,
    include: {
      loggedBy: { select: { id: true, name: true } },
      client: { select: { id: true, businessName: true } },
    },
    orderBy: { occurredAt: "desc" },
  });
  return c.json(interactions);
});

import { Hono } from "hono";
import { requireParam } from "../lib/http";
import { createRetainerSchema, updateRetainerSchema } from "../utils/validation";
import type { AppEnv } from "../types";

/** Mounted at /api/retainers */
export const retainersRouter = new Hono<AppEnv>();

retainersRouter.get("/", async (c) => {
  const retainers = await c.get("prisma").retainer.findMany({
    where: { isActive: true },
    include: { client: { select: { id: true, businessName: true, isActive: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return c.json(retainers);
});

retainersRouter.patch("/:id", async (c) => {
  const parsed = updateRetainerSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prisma = c.get("prisma");
  const id = c.req.param("id");
  const data = { ...parsed.data };

  // Activating a retainer with no start date would leave it out of the MRR
  // trend entirely, so stamp today the moment money starts.
  if (data.status === "ACTIVE" && !data.startDate) {
    const existing = await prisma.retainer.findUniqueOrThrow({ where: { id } });
    if (!existing.startDate) data.startDate = new Date();
  }

  const retainer = await prisma.retainer.update({ where: { id }, data });
  return c.json(retainer);
});

/*
 * Soft delete, matching Client. Deleting the row outright made past MRR
 * unreconstructable: mrrTrend rebuilds each month from retainer start and end
 * dates, so a removed retainer silently rewrote revenue history rather than
 * ending it.
 */
retainersRouter.delete("/:id", async (c) => {
  await c
    .get("prisma")
    .retainer.update({ where: { id: c.req.param("id") }, data: { isActive: false } });
  return c.body(null, 204);
});

/** Mounted at /api/clients/:clientId/retainers */
export const clientRetainersRouter = new Hono<AppEnv>();

clientRetainersRouter.get("/", async (c) => {
  const retainers = await c.get("prisma").retainer.findMany({
    where: { clientId: requireParam(c, "clientId"), isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return c.json(retainers);
});

clientRetainersRouter.post("/", async (c) => {
  const parsed = createRetainerSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const status = parsed.data.status ?? "PENDING_FIRST_PAYMENT";
  const retainer = await c.get("prisma").retainer.create({
    data: {
      ...parsed.data,
      status,
      startDate: parsed.data.startDate ?? (status === "ACTIVE" ? new Date() : null),
      clientId: requireParam(c, "clientId"),
    },
  });
  return c.json(retainer, 201);
});

/* Undo for the soft delete above. Open to both roles — see clients.routes.ts. */
retainersRouter.post("/:id/restore", async (c) => {
  const retainer = await c
    .get("prisma")
    .retainer.update({ where: { id: c.req.param("id") }, data: { isActive: true } });
  return c.json(retainer);
});

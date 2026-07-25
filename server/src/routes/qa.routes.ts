import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";

/**
 * Test-only hooks for scripts/lifecycleCheck.ts.
 *
 * The lifecycle check has to push automation anchors into the past and then hard
 * delete the client it created. Against Postgres it did both with a direct
 * Prisma connection; D1 is only reachable from inside the Worker, so the two
 * operations the public API genuinely cannot express live here instead.
 *
 * Everything else the check needs — backdating a launch date or a retainer's
 * start/end, reading history and tasks, soft deleting — goes through the real
 * endpoints, so the check still exercises the production paths.
 *
 * This router is mounted only when QA_HOOKS_ENABLED === "true" (see app.ts) and
 * additionally sits behind the session cookie. It must never be enabled in
 * production.
 */
const router = new Hono<AppEnv>();

const backdateTierSchema = z.object({
  clientId: z.string().min(1),
  toTier: z.string().min(1),
  changedAt: z.coerce.date(),
});

/** Moves the most recent move-into-`toTier` history row back in time. */
router.post("/backdate-tier-entry", async (c) => {
  const parsed = backdateTierSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prisma = c.get("prisma");
  const entry = await prisma.serviceHistoryEntry.findFirst({
    where: { clientId: parsed.data.clientId, toTier: parsed.data.toTier },
    orderBy: { changedAt: "desc" },
  });
  if (!entry) return c.json({ error: "No history entry for that tier" }, 404);

  const updated = await prisma.serviceHistoryEntry.update({
    where: { id: entry.id },
    data: { changedAt: parsed.data.changedAt },
  });
  return c.json(updated);
});

/** Hard delete, so the check can clean up after itself. The API only soft deletes. */
router.delete("/clients/:id", async (c) => {
  await c.get("prisma").client.delete({ where: { id: c.req.param("id") } });
  return c.body(null, 204);
});

export default router;

import { Hono } from "hono";
import { HttpError } from "../lib/http";
import { currentUser } from "../middleware/requireAuth";
import { requireDealClientAccess } from "../middleware/requireClientAccess";
import {
  diffWatchedFields,
  logFieldChanges,
  WATCHED_DEAL_FIELDS,
} from "../services/auditService";
import { convertDealSchema, createDealSchema, updateDealSchema } from "../utils/validation";
import { logStageChange, stageHistory } from "../services/dealStageService";
import { resolveStage, wonStage } from "../services/pipelineStageService";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

/** The stage object travels with every deal so the board can render without a join. */
const DEAL_INCLUDE = {
  client: { select: { id: true, businessName: true } },
  stage: true,
} as const;

router.get("/", async (c) => {
  const deals = await c.get("prisma").deal.findMany({
    include: DEAL_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return c.json(deals);
});

router.post("/", async (c) => {
  const parsed = createDealSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prisma = c.get("prisma");
  const { stageId, ...rest } = parsed.data;
  // Resolves to the first column when the client didn't name a stage, and 400s
  // on an id that isn't a real stage rather than letting the FK fail opaquely.
  const stage = await resolveStage(prisma, stageId);

  const deal = await prisma.deal.create({
    data: { ...rest, stageId: stage.id },
    include: DEAL_INCLUDE,
  });

  // The opening entry: no `from`, because the deal did not come from anywhere.
  await logStageChange(prisma, deal.id, null, stage, currentUser(c)?.id ?? null, "Deal created");

  return c.json(deal, 201);
});

/** The full stage timeline for one deal, newest first. */
router.get("/:id/stage-history", async (c) => {
  return c.json({ entries: await stageHistory(c.get("prisma"), c.req.param("id")) });
});

router.patch("/:id", requireDealClientAccess(), async (c) => {
  const parsed = updateDealSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prisma = c.get("prisma");
  const id = c.req.param("id");

  const existing = await prisma.deal.findUniqueOrThrow({
    where: { id },
    include: { stage: true },
  });

  const { stageId, ...rest } = parsed.data;
  const stageChanged = stageId !== undefined && stageId !== existing.stageId;
  // Only resolved when it actually changed, so an unrelated edit never pays for
  // the lookup and can never 400 on a stage it didn't touch.
  const nextStage = stageChanged ? await resolveStage(prisma, stageId) : null;

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      ...rest,
      ...(nextStage
        ? // Powers the "days in current stage" counter on the kanban card.
          { stageId: nextStage.id, stageChangedAt: new Date() }
        : {}),
    },
    include: DEAL_INCLUDE,
  });

  if (nextStage) {
    await logStageChange(prisma, id, existing.stage, nextStage, currentUser(c)?.id ?? null);
  }

  /*
   * Logged after the update, deliberately.
   *
   * D1 has no transactions, so these two writes cannot be atomic and the
   * ordering is a choice about which partial outcome is survivable. An edit that
   * lands without its log entry loses history; a log entry without its edit
   * claims something happened that did not. The second is worse, so the edit
   * goes first and the log never blocks it — logFieldChanges swallows its own
   * failures for the same reason.
   */
  await logFieldChanges(prisma, "Deal", id, currentUser(c)?.id ?? null, [
    ...diffWatchedFields(existing, rest, WATCHED_DEAL_FIELDS),
    // Recorded by name, not id — the client's history panel renders these values
    // verbatim, and a cuid tells the reader nothing.
    ...(nextStage
      ? [{ field: "stage", oldValue: existing.stage.name, newValue: nextStage.name }]
      : []),
  ]);

  return c.json(deal);
});

router.post("/:id/convert", async (c) => {
  const parsed = convertDealSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prisma = c.get("prisma");
  const deal = await prisma.deal.findUniqueOrThrow({
    where: { id: c.req.param("id") },
    include: { stage: true },
  });
  if (deal.clientId) throw new HttpError(409, "This deal has already been converted");

  const tier = parsed.data.currentTier ?? "WEBSITE_BUILD";
  const userId = c.get("user")?.id ?? null;

  // Create the client first, then mark the deal Won. D1 has no transactions, so
  // if the second write fails the deal stays open next to a real client record —
  // obvious on the pipeline board, and re-running convert is blocked by the
  // clientId guard above only once the link actually landed, so the operator can
  // simply retry. The reverse order could mark a deal Won with no client behind it.
  const client = await prisma.client.create({
    data: {
      businessName: deal.businessName,
      industry: parsed.data.industry ?? null,
      currentTier: tier,
      accountOwnerId: parsed.data.accountOwnerId ?? userId,
      notes: deal.notes,
      websiteLaunchDate: tier === "WEBSITE_LIVE" ? new Date() : null,
      serviceHistory: {
        create: {
          toTier: tier,
          changedById: userId,
          note: `Converted from deal "${deal.businessName}"`,
        },
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

  /*
   * "Won" is whichever stage carries the isWon flag, not the stage named "Won".
   * The name is editable now, so matching on it would silently stop working the
   * first time someone renames the column to "Closed Won". If the flag has been
   * cleared from every stage the deal keeps its current one — the client record
   * is the real outcome here, and refusing to convert over a missing flag would
   * be worse than a deal left sitting in Quoted.
   */
  const won = await wonStage(prisma);

  await prisma.deal.update({
    where: { id: deal.id },
    data: {
      clientId: client.id,
      ...(won ? { stageId: won.id, stageChangedAt: new Date() } : {}),
    },
  });

  if (won && won.id !== deal.stageId) {
    await logStageChange(prisma, deal.id, deal.stage, won, userId, "Converted to client");
  }

  return c.json(client, 201);
});

router.delete("/:id", requireDealClientAccess(), async (c) => {
  await c.get("prisma").deal.delete({ where: { id: c.req.param("id") } });
  return c.body(null, 204);
});

export default router;

import { Hono } from "hono";
import { HttpError } from "../lib/http";
import { convertDealSchema, createDealSchema, updateDealSchema } from "../utils/validation";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

router.get("/", async (c) => {
  const deals = await c.get("prisma").deal.findMany({
    include: { client: { select: { id: true, businessName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return c.json(deals);
});

router.post("/", async (c) => {
  const parsed = createDealSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const deal = await c.get("prisma").deal.create({ data: parsed.data });
  return c.json(deal, 201);
});

router.patch("/:id", async (c) => {
  const parsed = updateDealSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prisma = c.get("prisma");
  const id = c.req.param("id");

  const existing = await prisma.deal.findUniqueOrThrow({ where: { id } });
  const stageChanged = parsed.data.stage && parsed.data.stage !== existing.stage;

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      ...parsed.data,
      // Powers the "days in current stage" counter on the kanban card.
      ...(stageChanged ? { stageChangedAt: new Date() } : {}),
    },
  });
  return c.json(deal);
});

router.post("/:id/convert", async (c) => {
  const parsed = convertDealSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prisma = c.get("prisma");
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: c.req.param("id") } });
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

  await prisma.deal.update({
    where: { id: deal.id },
    data: { clientId: client.id, stage: "Won", stageChangedAt: new Date() },
  });

  return c.json(client, 201);
});

router.delete("/:id", async (c) => {
  await c.get("prisma").deal.delete({ where: { id: c.req.param("id") } });
  return c.body(null, 204);
});

export default router;

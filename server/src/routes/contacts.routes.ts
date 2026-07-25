import { Hono } from "hono";
import { requireParam } from "../lib/http";
import { createContactSchema, updateContactSchema } from "../utils/validation";
import type { PrismaClient } from "../generated/prisma/client";
import type { AppEnv } from "../types";

/** Mounted at /api/clients/:clientId/contacts */
export const clientContactsRouter = new Hono<AppEnv>();

clientContactsRouter.get("/", async (c) => {
  const contacts = await c.get("prisma").contact.findMany({
    where: { clientId: requireParam(c, "clientId") },
    orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }],
  });
  return c.json(contacts);
});

clientContactsRouter.post("/", async (c) => {
  const parsed = createContactSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prisma = c.get("prisma");
  const clientId = requireParam(c, "clientId");

  // Demote first, create second. D1 has no transactions, so if the create fails
  // the client is briefly left with no primary contact — which the sidebar
  // renders as "no primary contact" and the next save fixes. The reverse order
  // could leave two primaries, which the UI has no way to show or resolve.
  if (parsed.data.isPrimary) await demoteOtherPrimaries(prisma, clientId);
  const contact = await prisma.contact.create({ data: { ...parsed.data, clientId } });

  return c.json(contact, 201);
});

/** Mounted at /api/contacts */
export const contactsRouter = new Hono<AppEnv>();

contactsRouter.patch("/:id", async (c) => {
  const parsed = updateContactSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prisma = c.get("prisma");
  const id = c.req.param("id");

  const existing = await prisma.contact.findUniqueOrThrow({ where: { id } });
  if (parsed.data.isPrimary) {
    await demoteOtherPrimaries(prisma, existing.clientId, existing.id);
  }
  const contact = await prisma.contact.update({ where: { id }, data: parsed.data });

  return c.json(contact);
});

contactsRouter.delete("/:id", async (c) => {
  await c.get("prisma").contact.delete({ where: { id: c.req.param("id") } });
  return c.body(null, 204);
});

/** Exactly one primary contact per client — the sidebar shows only one. */
async function demoteOtherPrimaries(
  prisma: PrismaClient,
  clientId: string,
  exceptId?: string
): Promise<void> {
  await prisma.contact.updateMany({
    where: { clientId, isPrimary: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { isPrimary: false },
  });
}

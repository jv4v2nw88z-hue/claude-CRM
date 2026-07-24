import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { asyncHandler } from "../middleware/errorHandler";
import { createContactSchema, updateContactSchema } from "../utils/validation";

/** Mounted at /api/clients/:clientId/contacts */
export const clientContactsRouter = Router({ mergeParams: true });

clientContactsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const contacts = await prisma.contact.findMany({
      where: { clientId: req.params.clientId },
      orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }],
    });
    res.json(contacts);
  })
);

clientContactsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createContactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { clientId } = req.params;
    const contact = await prisma.$transaction(async (tx) => {
      if (parsed.data.isPrimary) await demoteOtherPrimaries(tx, clientId);
      return tx.contact.create({ data: { ...parsed.data, clientId } });
    });

    res.status(201).json(contact);
  })
);

/** Mounted at /api/contacts */
export const contactsRouter = Router();

contactsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateContactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const contact = await prisma.$transaction(async (tx) => {
      const existing = await tx.contact.findUniqueOrThrow({ where: { id: req.params.id } });
      if (parsed.data.isPrimary) await demoteOtherPrimaries(tx, existing.clientId, existing.id);
      return tx.contact.update({ where: { id: req.params.id }, data: parsed.data });
    });

    res.json(contact);
  })
);

contactsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

/** Exactly one primary contact per client — the sidebar shows only one. */
async function demoteOtherPrimaries(
  tx: Prisma.TransactionClient,
  clientId: string,
  exceptId?: string
) {
  await tx.contact.updateMany({
    where: { clientId, isPrimary: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { isPrimary: false },
  });
}

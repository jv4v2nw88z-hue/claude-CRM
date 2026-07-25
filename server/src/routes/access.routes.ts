import { Hono } from "hono";
import { HttpError, requireParam } from "../lib/http";
import { currentUser } from "../middleware/requireAuth";
import { canManageAccess } from "../services/accessService";
import { grantAccessSchema } from "../utils/validation";
import type { AppEnv } from "../types";

/**
 * Access management for one client. Mounted at /api/clients/:clientId/access.
 *
 * Listing is open to any authenticated user, matching the read policy for
 * everything else — you can see who holds the account without being on it.
 * Changing the list is owner-or-TECHNICAL.
 */
export const clientAccessRouter = new Hono<AppEnv>();

/** Owner plus collaborators, with the owner marked so the UI can't mix them up. */
clientAccessRouter.get("/", async (c) => {
  const clientId = requireParam(c, "clientId");
  const prisma = c.get("prisma");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      accountOwnerId: true,
      accountOwner: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  if (!client) throw new HttpError(404, "Client not found");

  const grants = await prisma.accountAccess.findMany({
    where: { clientId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      grantedBy: { select: { id: true, name: true } },
    },
    orderBy: { grantedAt: "asc" },
  });

  const user = currentUser(c);
  return c.json({
    owner: client.accountOwner,
    collaborators: grants.map((g) => ({
      ...g.user,
      grantedAt: g.grantedAt,
      grantedBy: g.grantedBy,
    })),
    /* Lets the UI hide the controls rather than showing buttons that 403. */
    canManage: user ? await canManageAccess(prisma, clientId, user) : false,
  });
});

clientAccessRouter.post("/", async (c) => {
  const clientId = requireParam(c, "clientId");
  const prisma = c.get("prisma");
  const user = currentUser(c);
  if (!user) throw new HttpError(401, "Not authenticated");

  if (!(await canManageAccess(prisma, clientId, user))) {
    throw new HttpError(403, "Only this client's owner can change who has access.");
  }

  const parsed = grantAccessSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { accountOwnerId: true },
  });
  if (!client) throw new HttpError(404, "Client not found");

  // Granting the owner access is a no-op that would show them twice in the list.
  if (client.accountOwnerId === parsed.data.userId) {
    throw new HttpError(400, "That user already owns this client.");
  }

  /*
   * Upsert rather than create: the unique constraint already makes a second
   * grant impossible, and surfacing that as a 409 would mean the UI has to treat
   * "already has access" as an error when it is the desired end state.
   */
  const grant = await prisma.accountAccess.upsert({
    where: { clientId_userId: { clientId, userId: parsed.data.userId } },
    update: {},
    create: { clientId, userId: parsed.data.userId, grantedById: user.id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  return c.json(grant, 201);
});

clientAccessRouter.delete("/:userId", async (c) => {
  const clientId = requireParam(c, "clientId");
  const userId = requireParam(c, "userId");
  const prisma = c.get("prisma");
  const user = currentUser(c);
  if (!user) throw new HttpError(401, "Not authenticated");

  if (!(await canManageAccess(prisma, clientId, user))) {
    throw new HttpError(403, "Only this client's owner can change who has access.");
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { accountOwnerId: true },
  });
  if (client?.accountOwnerId === userId) {
    throw new HttpError(
      400,
      "You can't revoke the owner's access. Transfer ownership to someone else instead."
    );
  }

  // deleteMany, not delete: revoking access that isn't there should succeed
  // quietly rather than 404 — the caller's intent is already satisfied.
  await prisma.accountAccess.deleteMany({ where: { clientId, userId } });
  return c.body(null, 204);
});

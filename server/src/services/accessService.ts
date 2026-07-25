import type { PrismaClient } from "../generated/prisma/client";
import type { AuthedUser } from "../types";

/**
 * Who may write to a client.
 *
 * Three ways in, checked in this order because they get progressively more
 * expensive: the role is already on the request, the owner id comes with the
 * client row, and only a delegated grant needs its own lookup.
 *
 * Reads are deliberately not gated. Both people need to see the whole book to do
 * their jobs — Cole can't spot an at-risk client he can't see — so this is a
 * guard against unintended *changes*, not a confidentiality boundary. Scoping
 * reads would be a separate decision with a much larger blast radius.
 */

export type AccessReason = "TECHNICAL_OVERRIDE" | "OWNER" | "DELEGATED";

export interface AccessDecision {
  allowed: boolean;
  reason: AccessReason | "DENIED";
}

export async function resolveClientAccess(
  prisma: PrismaClient,
  clientId: string,
  user: AuthedUser
): Promise<AccessDecision> {
  /*
   * TECHNICAL bypasses ownership entirely — a technical fix on any client must
   * never be blocked by an access list. Confirmed as the intended behaviour, and
   * the reason every use of it is recorded: an unrestricted override that leaves
   * no trace is indistinguishable from a permissions bug, and stays that way
   * until someone is trying to reconstruct who changed what.
   */
  if (user.role === "TECHNICAL") {
    return { allowed: true, reason: "TECHNICAL_OVERRIDE" };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { accountOwnerId: true },
  });
  if (!client) return { allowed: false, reason: "DENIED" };

  if (client.accountOwnerId === user.id) {
    return { allowed: true, reason: "OWNER" };
  }

  const grant = await prisma.accountAccess.findUnique({
    where: { clientId_userId: { clientId, userId: user.id } },
    select: { id: true },
  });

  return grant ? { allowed: true, reason: "DELEGATED" } : { allowed: false, reason: "DENIED" };
}

/**
 * May this user manage the access list?
 *
 * Owner or TECHNICAL only. A delegated collaborator can write to the client but
 * cannot widen the list further — otherwise one grant quietly becomes the
 * ability to grant, and the owner is no longer the one deciding who gets in.
 */
export async function canManageAccess(
  prisma: PrismaClient,
  clientId: string,
  user: AuthedUser
): Promise<boolean> {
  if (user.role === "TECHNICAL") return true;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { accountOwnerId: true },
  });
  return client?.accountOwnerId === user.id;
}

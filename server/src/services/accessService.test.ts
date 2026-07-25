import { describe, expect, it, vi } from "vitest";
import { canManageAccess, resolveClientAccess } from "./accessService";
import type { AuthedUser } from "../types";
import type { PrismaClient } from "../generated/prisma/client";

/**
 * Write access resolution.
 *
 * Unit-level rather than through HTTP: this is a four-branch decision and the
 * branches are what matter, so the database is stubbed to whatever shape each
 * case needs. The end-to-end proof that the middleware actually applies the
 * decision lives in qa:lifecycle.
 */

function user(overrides: Partial<AuthedUser> = {}): AuthedUser {
  return {
    id: "user-cole",
    name: "Cole",
    email: "cole@example.com",
    role: "SALES",
    mustChangePassword: false,
    ...overrides,
  };
}

/** Minimal stub: only the two reads resolveClientAccess can make. */
function stubPrisma(opts: { accountOwnerId?: string | null; hasGrant?: boolean } = {}) {
  const findClient = vi.fn().mockResolvedValue(
    opts.accountOwnerId === undefined ? null : { accountOwnerId: opts.accountOwnerId }
  );
  const findGrant = vi.fn().mockResolvedValue(opts.hasGrant ? { id: "grant-1" } : null);
  return {
    prisma: {
      client: { findUnique: findClient },
      accountAccess: { findUnique: findGrant },
    } as unknown as PrismaClient,
    findClient,
    findGrant,
  };
}

describe("resolveClientAccess", () => {
  it("allows the owner", async () => {
    const { prisma } = stubPrisma({ accountOwnerId: "user-cole" });
    expect(await resolveClientAccess(prisma, "c1", user())).toEqual({
      allowed: true,
      reason: "OWNER",
    });
  });

  it("allows a granted collaborator", async () => {
    const { prisma } = stubPrisma({ accountOwnerId: "someone-else", hasGrant: true });
    expect(await resolveClientAccess(prisma, "c1", user())).toEqual({
      allowed: true,
      reason: "DELEGATED",
    });
  });

  it("denies an unrelated user", async () => {
    const { prisma } = stubPrisma({ accountOwnerId: "someone-else", hasGrant: false });
    expect(await resolveClientAccess(prisma, "c1", user())).toEqual({
      allowed: false,
      reason: "DENIED",
    });
  });

  it("denies when the client does not exist", async () => {
    const { prisma } = stubPrisma({});
    expect(await resolveClientAccess(prisma, "missing", user())).toEqual({
      allowed: false,
      reason: "DENIED",
    });
  });

  it("allows TECHNICAL regardless of owner or grant", async () => {
    const { prisma } = stubPrisma({ accountOwnerId: "someone-else", hasGrant: false });
    expect(
      await resolveClientAccess(prisma, "c1", user({ id: "user-brian", role: "TECHNICAL" }))
    ).toEqual({ allowed: true, reason: "TECHNICAL_OVERRIDE" });
  });

  it("reports TECHNICAL access as an override even when they also own the client", async () => {
    // The reason drives the audit log. If owning the record downgraded the
    // reason to OWNER, an admin's writes to their own clients would stop being
    // recorded — a gap that widens exactly as one person accumulates accounts.
    const { prisma } = stubPrisma({ accountOwnerId: "user-brian" });
    expect(
      await resolveClientAccess(prisma, "c1", user({ id: "user-brian", role: "TECHNICAL" }))
    ).toEqual({ allowed: true, reason: "TECHNICAL_OVERRIDE" });
  });

  it("short-circuits for TECHNICAL without touching the database", async () => {
    // Not a micro-optimisation: it means the override cannot be blocked by a
    // missing or unreadable client row, which is the situation a technical fix
    // is most likely to be needed in.
    const { prisma, findClient, findGrant } = stubPrisma({ accountOwnerId: "x" });
    await resolveClientAccess(prisma, "c1", user({ role: "TECHNICAL" }));
    expect(findClient).not.toHaveBeenCalled();
    expect(findGrant).not.toHaveBeenCalled();
  });

  it("revoking a grant denies the next request", async () => {
    const granted = stubPrisma({ accountOwnerId: "someone-else", hasGrant: true });
    expect((await resolveClientAccess(granted.prisma, "c1", user())).allowed).toBe(true);

    const revoked = stubPrisma({ accountOwnerId: "someone-else", hasGrant: false });
    expect((await resolveClientAccess(revoked.prisma, "c1", user())).allowed).toBe(false);
  });

  it("follows ownership after a transfer", async () => {
    const before = stubPrisma({ accountOwnerId: "user-cole" });
    expect((await resolveClientAccess(before.prisma, "c1", user())).reason).toBe("OWNER");

    const after = stubPrisma({ accountOwnerId: "user-brian", hasGrant: false });
    expect((await resolveClientAccess(after.prisma, "c1", user())).allowed).toBe(false);
  });
});

describe("canManageAccess", () => {
  it("allows the owner", async () => {
    const { prisma } = stubPrisma({ accountOwnerId: "user-cole" });
    expect(await canManageAccess(prisma, "c1", user())).toBe(true);
  });

  it("allows TECHNICAL", async () => {
    const { prisma } = stubPrisma({ accountOwnerId: "someone-else" });
    expect(await canManageAccess(prisma, "c1", user({ role: "TECHNICAL" }))).toBe(true);
  });

  it("refuses a delegated collaborator", async () => {
    // A collaborator can write to the client but must not be able to widen the
    // list — otherwise one grant quietly becomes the power to grant, and the
    // owner is no longer deciding who is on the account.
    const { prisma } = stubPrisma({ accountOwnerId: "someone-else", hasGrant: true });
    expect(await canManageAccess(prisma, "c1", user())).toBe(false);
  });
});

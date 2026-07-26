import { describe, expect, it, vi } from "vitest";
import { applyOutcomeFlags, defaultStage, deleteStage, resolveStage } from "./pipelineStageService";
import { HttpError } from "../lib/http";
import type { PrismaClient } from "../generated/prisma/client";

/**
 * Pipeline stage invariants.
 *
 * Unit-level for the same reason as accessService: these are decision branches,
 * and the branch that matters most (refusing to delete a stage still holding
 * deals) is exactly the one that is expensive to reproduce with real data. The
 * end-to-end proof that the routes enforce them is in qa:lifecycle.
 */

interface StageRow {
  id: string;
  name: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
}

function stage(overrides: Partial<StageRow> = {}): StageRow {
  return { id: "stage_new", name: "New", order: 100, isWon: false, isLost: false, ...overrides };
}

function stubPrisma(opts: {
  stages?: StageRow[];
  dealCount?: number;
  findUniqueResult?: StageRow | null;
} = {}) {
  const stages = opts.stages ?? [stage()];

  const findFirst = vi.fn(({ where }: { where?: Record<string, unknown> } = {}) => {
    if (where?.isWon) return Promise.resolve(stages.find((s) => s.isWon) ?? null);
    // defaultStage asks for the lowest order.
    const sorted = [...stages].sort((a, b) => a.order - b.order);
    return Promise.resolve(sorted[0] ?? null);
  });

  const findUnique = vi.fn(({ where }: { where: { id?: string } }) => {
    if (opts.findUniqueResult !== undefined) return Promise.resolve(opts.findUniqueResult);
    return Promise.resolve(stages.find((s) => s.id === where.id) ?? null);
  });

  const stageCount = vi.fn(({ where }: { where?: { id?: { not?: string } } } = {}) =>
    Promise.resolve(stages.filter((s) => s.id !== where?.id?.not).length)
  );

  const dealCount = vi.fn().mockResolvedValue(opts.dealCount ?? 0);
  const updateMany = vi.fn().mockResolvedValue({ count: 0 });
  const dealUpdateMany = vi.fn().mockResolvedValue({ count: opts.dealCount ?? 0 });
  const deleteStageFn = vi.fn().mockResolvedValue(stages[0]);

  return {
    prisma: {
      pipelineStage: {
        findFirst,
        findUnique,
        count: stageCount,
        updateMany,
        delete: deleteStageFn,
      },
      deal: { count: dealCount, updateMany: dealUpdateMany },
    } as unknown as PrismaClient,
    findFirst,
    updateMany,
    dealUpdateMany,
    deleteStageFn,
  };
}

describe("defaultStage", () => {
  it("returns the leftmost column rather than one named 'New'", async () => {
    // The first column is whatever the board says after a reorder. Hard-coding
    // "New" would silently break the moment someone renames or moves it.
    const { prisma } = stubPrisma({
      stages: [stage({ id: "s2", name: "Triage", order: 50 }), stage({ order: 100 })],
    });
    expect((await defaultStage(prisma)).id).toBe("s2");
  });

  it("throws rather than returning null when the board is empty", async () => {
    const { prisma } = stubPrisma({ stages: [] });
    await expect(defaultStage(prisma)).rejects.toThrow(HttpError);
  });
});

describe("resolveStage", () => {
  it("falls back to the first column when no stage is named", async () => {
    const { prisma } = stubPrisma();
    expect((await resolveStage(prisma, undefined)).id).toBe("stage_new");
  });

  it("rejects an id that isn't a real stage", async () => {
    // A 400 here rather than letting the foreign key fail: D1 surfaces an FK
    // violation as an opaque constraint error, which reads as a server bug.
    const { prisma } = stubPrisma({ findUniqueResult: null });
    await expect(resolveStage(prisma, "nope")).rejects.toThrow(/no longer exists/);
  });
});

describe("applyOutcomeFlags", () => {
  it("refuses a stage that is both the won and the lost outcome", async () => {
    const { prisma } = stubPrisma();
    await expect(applyOutcomeFlags(prisma, "s1", true, true)).rejects.toThrow(/not both/);
  });

  it("clears the won flag from whichever stage held it", async () => {
    // Two stages claiming isWon would make conversion fire on whichever the
    // query happened to return first.
    const { prisma, updateMany } = stubPrisma();
    await applyOutcomeFlags(prisma, "s2", true, false);
    expect(updateMany).toHaveBeenCalledWith({
      where: { isWon: true, id: { not: "s2" } },
      data: { isWon: false },
    });
  });

  it("leaves other stages alone when neither flag is set", async () => {
    const { prisma, updateMany } = stubPrisma();
    await applyOutcomeFlags(prisma, "s2", false, false);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("deleteStage", () => {
  it("refuses to delete a stage that still holds deals", async () => {
    const { prisma, deleteStageFn } = stubPrisma({
      stages: [stage({ id: "s1" }), stage({ id: "s2", name: "Won", order: 200 })],
      dealCount: 3,
    });
    await expect(deleteStage(prisma, "s1")).rejects.toThrow(/still has 3 deals/);
    expect(deleteStageFn).not.toHaveBeenCalled();
  });

  it("moves the deals before dropping the stage when given a destination", async () => {
    const { prisma, dealUpdateMany, deleteStageFn } = stubPrisma({
      stages: [stage({ id: "s1" }), stage({ id: "s2", name: "Won", order: 200 })],
      dealCount: 2,
    });
    const result = await deleteStage(prisma, "s1", { reassignToId: "s2" });
    expect(dealUpdateMany).toHaveBeenCalledWith({
      where: { stageId: "s1" },
      data: { stageId: "s2" },
    });
    expect(deleteStageFn).toHaveBeenCalled();
    expect(result).toEqual({ movedDeals: 2 });
  });

  it("refuses to delete the last stage even when it is empty", async () => {
    // A pipeline with no columns has nowhere to put a new deal, so every
    // subsequent create would fail on the NOT NULL stageId.
    const { prisma, deleteStageFn } = stubPrisma({ stages: [stage({ id: "s1" })], dealCount: 0 });
    await expect(deleteStage(prisma, "s1")).rejects.toThrow(/at least one column/);
    expect(deleteStageFn).not.toHaveBeenCalled();
  });

  it("deletes an empty stage without asking where to move anything", async () => {
    const { prisma, dealUpdateMany, deleteStageFn } = stubPrisma({
      stages: [stage({ id: "s1" }), stage({ id: "s2", order: 200 })],
      dealCount: 0,
    });
    expect(await deleteStage(prisma, "s1")).toEqual({ movedDeals: 0 });
    expect(dealUpdateMany).not.toHaveBeenCalled();
    expect(deleteStageFn).toHaveBeenCalled();
  });

  it("refuses to move deals into the stage being deleted", async () => {
    const { prisma, deleteStageFn } = stubPrisma({
      stages: [stage({ id: "s1" }), stage({ id: "s2", order: 200 })],
      dealCount: 1,
    });
    await expect(deleteStage(prisma, "s1", { reassignToId: "s1" })).rejects.toThrow(
      /being deleted/
    );
    expect(deleteStageFn).not.toHaveBeenCalled();
  });

  it("404s on a stage that isn't there", async () => {
    const { prisma } = stubPrisma({ findUniqueResult: null });
    await expect(deleteStage(prisma, "ghost")).rejects.toThrow(/not found/i);
  });
});

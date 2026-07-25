import { describe, expect, it } from "vitest";
import {
  activeMrr,
  mrrByTier,
  mrrLostThisQuarter,
  mrrTrend,
  pendingMrr,
  type RetainerLike,
} from "./retainerService";

/**
 * MRR arithmetic.
 *
 * These three functions decide the headline number on the dashboard, and until
 * now the only thing checking them was one happy-path pass in qa:lifecycle. The
 * cases below are deliberately the awkward ones — a null start date, a retainer
 * straddling a quarter boundary, two active retainers on one client — because
 * those are where a wrong answer is both plausible and invisible.
 */

function retainer(overrides: Partial<RetainerLike> = {}): RetainerLike {
  return {
    monthlyAmount: 500,
    status: "ACTIVE",
    startDate: new Date("2026-01-01T09:00:00Z"),
    endDate: null,
    tier: "BRAND_CURATION",
    updatedAt: new Date("2026-01-01T09:00:00Z"),
    ...overrides,
  };
}

describe("activeMrr", () => {
  it("counts only ACTIVE retainers", () => {
    expect(
      activeMrr([
        retainer({ monthlyAmount: 600 }),
        retainer({ monthlyAmount: 1000, status: "PENDING_FIRST_PAYMENT" }),
        retainer({ monthlyAmount: 250, status: "PAUSED" }),
        retainer({ monthlyAmount: 999, status: "CANCELLED" }),
      ])
    ).toBe(600);
  });

  it("sums two active retainers on the same client", () => {
    // The upsell path is explicitly additive — a client on brand curation who
    // adds social has two live retainers, and both are real revenue.
    expect(activeMrr([retainer({ monthlyAmount: 600 }), retainer({ monthlyAmount: 850 })])).toBe(
      1450
    );
  });

  it("is zero, not NaN, for a client with no retainers", () => {
    expect(activeMrr([])).toBe(0);
  });

  it("counts an active retainer with no start date", () => {
    // A missing start date means nobody filled the field in, not that the money
    // isn't arriving. Status is the source of truth for "banking it today".
    expect(activeMrr([retainer({ startDate: null, monthlyAmount: 700 })])).toBe(700);
  });
});

describe("pendingMrr", () => {
  it("reports signed-but-not-collecting separately from active", () => {
    const rows = [
      retainer({ monthlyAmount: 600 }),
      retainer({ monthlyAmount: 1000, status: "PENDING_FIRST_PAYMENT" }),
    ];
    expect(activeMrr(rows)).toBe(600);
    expect(pendingMrr(rows)).toBe(1000);
  });
});

describe("mrrByTier", () => {
  it("groups active revenue by tier and ignores everything else", () => {
    expect(
      mrrByTier([
        retainer({ tier: "BRAND_CURATION", monthlyAmount: 600 }),
        retainer({ tier: "BRAND_CURATION", monthlyAmount: 400 }),
        retainer({ tier: "SOCIAL_MEDIA", monthlyAmount: 850 }),
        retainer({ tier: "ANALYTICS", monthlyAmount: 1000, status: "CANCELLED" }),
      ])
    ).toEqual({ BRAND_CURATION: 1000, SOCIAL_MEDIA: 850 });
  });
});

describe("mrrTrend", () => {
  const june = new Date("2026-06-15T12:00:00Z");

  it("returns one point per month, oldest first", () => {
    const points = mrrTrend([], 6, june);
    expect(points).toHaveLength(6);
    expect(points[0].month).toBe("2026-01");
    expect(points[5].month).toBe("2026-06");
  });

  it("excludes a retainer with no start date from every month", () => {
    // The audit called this out specifically. Without a start date there is no
    // month we can honestly say it was billing in, so it must not inflate any
    // historical point — even though activeMrr does count it today.
    const points = mrrTrend([retainer({ startDate: null, monthlyAmount: 900 })], 6, june);
    expect(points.every((p) => p.mrr === 0)).toBe(true);
  });

  it("starts counting in the month the retainer began, not before", () => {
    const points = mrrTrend(
      [retainer({ startDate: new Date("2026-04-10T00:00:00Z"), monthlyAmount: 600 })],
      6,
      june
    );
    expect(points.map((p) => p.mrr)).toEqual([0, 0, 0, 600, 600, 600]);
  });

  it("counts the month a retainer started even when it started on the last day", () => {
    const points = mrrTrend(
      [retainer({ startDate: new Date("2026-04-30T23:00:00Z"), monthlyAmount: 600 })],
      6,
      june
    );
    expect(points[3].mrr).toBe(600);
  });

  it("stops counting after an explicit end date", () => {
    const points = mrrTrend(
      [
        retainer({
          startDate: new Date("2026-01-01T00:00:00Z"),
          endDate: new Date("2026-03-31T00:00:00Z"),
          status: "CANCELLED",
          monthlyAmount: 500,
        }),
      ],
      6,
      june
    );
    expect(points.map((p) => p.mrr)).toEqual([500, 500, 500, 0, 0, 0]);
  });

  it("falls back to updatedAt when a cancelled retainer has no end date", () => {
    const points = mrrTrend(
      [
        retainer({
          startDate: new Date("2026-01-01T00:00:00Z"),
          endDate: null,
          status: "CANCELLED",
          updatedAt: new Date("2026-03-20T00:00:00Z"),
          monthlyAmount: 500,
        }),
      ],
      6,
      june
    );
    expect(points.map((p) => p.mrr)).toEqual([500, 500, 500, 0, 0, 0]);
  });

  it("never counts PENDING_FIRST_PAYMENT, however old", () => {
    const points = mrrTrend(
      [
        retainer({
          status: "PENDING_FIRST_PAYMENT",
          startDate: new Date("2025-01-01T00:00:00Z"),
          monthlyAmount: 1000,
        }),
      ],
      6,
      june
    );
    expect(points.every((p) => p.mrr === 0)).toBe(true);
  });

  it("adds up two concurrent retainers in the overlapping months", () => {
    const points = mrrTrend(
      [
        retainer({ startDate: new Date("2026-01-01T00:00:00Z"), monthlyAmount: 600 }),
        retainer({ startDate: new Date("2026-05-01T00:00:00Z"), monthlyAmount: 850 }),
      ],
      6,
      june
    );
    expect(points.map((p) => p.mrr)).toEqual([600, 600, 600, 600, 1450, 1450]);
  });
});

describe("mrrLostThisQuarter", () => {
  // Q2 2026 runs April–June.
  const may = new Date("2026-05-15T12:00:00Z");

  it("counts a cancellation inside the quarter", () => {
    expect(
      mrrLostThisQuarter(
        [
          retainer({
            status: "CANCELLED",
            endDate: new Date("2026-04-20T00:00:00Z"),
            monthlyAmount: 500,
          }),
        ],
        may
      )
    ).toBe(500);
  });

  it("excludes a cancellation from the previous quarter", () => {
    // The boundary case: 31 March is Q1, and counting it would make the number
    // look worse than the quarter actually was.
    expect(
      mrrLostThisQuarter(
        [
          retainer({
            status: "CANCELLED",
            endDate: new Date("2026-03-31T23:59:00Z"),
            monthlyAmount: 500,
          }),
        ],
        may
      )
    ).toBe(0);
  });

  it("counts a cancellation on the first instant of the quarter", () => {
    expect(
      mrrLostThisQuarter(
        [
          retainer({
            status: "CANCELLED",
            endDate: new Date(2026, 3, 1, 0, 0, 0),
            monthlyAmount: 400,
          }),
        ],
        may
      )
    ).toBe(400);
  });

  it("excludes a future-dated cancellation", () => {
    // A retainer ending next month has not been lost yet.
    expect(
      mrrLostThisQuarter(
        [
          retainer({
            status: "CANCELLED",
            endDate: new Date("2026-06-30T00:00:00Z"),
            monthlyAmount: 500,
          }),
        ],
        may
      )
    ).toBe(0);
  });

  it("ignores paused retainers — paused is not lost", () => {
    expect(
      mrrLostThisQuarter(
        [
          retainer({
            status: "PAUSED",
            endDate: new Date("2026-04-20T00:00:00Z"),
            monthlyAmount: 500,
          }),
        ],
        may
      )
    ).toBe(0);
  });

  it("falls back to updatedAt when a cancelled retainer has no end date", () => {
    expect(
      mrrLostThisQuarter(
        [
          retainer({
            status: "CANCELLED",
            endDate: null,
            updatedAt: new Date("2026-04-05T00:00:00Z"),
            monthlyAmount: 750,
          }),
        ],
        may
      )
    ).toBe(750);
  });
});

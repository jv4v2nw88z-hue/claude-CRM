import { describe, expect, it } from "vitest";
import { getAnchorDate, planTask, type ClientRow, type Rule } from "./automationEngine";

/**
 * Anchor-date computation — when a reminder is due.
 *
 * This is the arithmetic the product's whole promise rests on: get it wrong and
 * either a client sits at WEBSITE_LIVE unpitched forever, or the same nag fires
 * every morning until someone turns the engine off. qa:lifecycle proves the
 * happy path fires; these cover the cases it can't reach.
 */

const NOW = new Date("2026-06-15T12:00:00Z");

function client(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: "client-1",
    businessName: "Sunrise Cafe",
    currentTier: "WEBSITE_LIVE",
    websiteLaunchDate: new Date("2026-04-01T09:00:00Z"),
    accountOwnerId: "user-cole",
    retainers: [],
    tasks: [],
    ...overrides,
  };
}

function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "rule-1",
    name: "Pitch Brand Curation",
    triggerTier: "WEBSITE_LIVE",
    anchor: "TIER_CHANGE",
    daysAfterTrigger: 30,
    repeatEveryDays: null,
    requiresActiveRetainer: false,
    taskTitleTemplate: "Pitch brand curation package to {{businessName}}",
    taskType: "AUTO_UPSELL_PITCH",
    ...overrides,
  };
}

const noHistory = new Map<string, Date>();

describe("getAnchorDate", () => {
  it("anchors a WEBSITE_LIVE rule on the launch date", () => {
    const anchor = getAnchorDate(client(), rule(), noHistory);
    expect(anchor).toEqual(new Date("2026-04-01T09:00:00Z"));
  });

  it("falls back to tier history when the launch date was never filled in", () => {
    const history = new Map([["client-1:WEBSITE_LIVE", new Date("2026-03-10T00:00:00Z")]]);
    const anchor = getAnchorDate(client({ websiteLaunchDate: null }), rule(), history);
    expect(anchor).toEqual(new Date("2026-03-10T00:00:00Z"));
  });

  it("returns null when neither a launch date nor a history row exists", () => {
    // No anchor means no countdown — the rule must stay silent rather than
    // treating "unknown" as "now" and firing immediately.
    expect(getAnchorDate(client({ websiteLaunchDate: null }), rule(), noHistory)).toBeNull();
  });

  it("anchors a non-launch tier rule on the latest move into that tier", () => {
    const history = new Map([["client-1:BRAND_CURATION", new Date("2026-05-01T00:00:00Z")]]);
    const anchor = getAnchorDate(
      client({ currentTier: "BRAND_CURATION" }),
      rule({ triggerTier: "BRAND_CURATION" }),
      history
    );
    expect(anchor).toEqual(new Date("2026-05-01T00:00:00Z"));
  });

  it("anchors RETAINER_START on the earliest active retainer", () => {
    const anchor = getAnchorDate(
      client({
        retainers: [
          { status: "ACTIVE", startDate: new Date("2026-05-01T00:00:00Z"), endDate: null },
          { status: "ACTIVE", startDate: new Date("2026-02-01T00:00:00Z"), endDate: null },
        ],
      }),
      rule({ anchor: "RETAINER_START", triggerTier: null }),
      noHistory
    );
    expect(anchor).toEqual(new Date("2026-02-01T00:00:00Z"));
  });

  it("ignores non-active retainers when anchoring RETAINER_START", () => {
    expect(
      getAnchorDate(
        client({
          retainers: [
            { status: "CANCELLED", startDate: new Date("2026-01-01T00:00:00Z"), endDate: null },
          ],
        }),
        rule({ anchor: "RETAINER_START", triggerTier: null }),
        noHistory
      )
    ).toBeNull();
  });

  it("shifts a RETAINER_END anchor backwards by the negative offset", () => {
    // "14 days before expiry" is expressed as daysAfterTrigger: -14, so an end
    // date of 1 July must anchor on 17 June.
    const anchor = getAnchorDate(
      client({
        retainers: [
          {
            status: "ACTIVE",
            startDate: new Date("2026-01-01T00:00:00Z"),
            endDate: new Date("2026-07-01T00:00:00Z"),
          },
        ],
      }),
      rule({ anchor: "RETAINER_END", triggerTier: null, daysAfterTrigger: -14 }),
      noHistory
    );
    expect(anchor).toEqual(new Date("2026-06-17T00:00:00Z"));
  });

  it("returns null for RETAINER_END when no retainer has an end date", () => {
    // An open-ended retainer never expires, so a renewal reminder has nothing to
    // count towards and must not fire.
    expect(
      getAnchorDate(
        client({
          retainers: [
            { status: "ACTIVE", startDate: new Date("2026-01-01T00:00:00Z"), endDate: null },
          ],
        }),
        rule({ anchor: "RETAINER_END", triggerTier: null, daysAfterTrigger: -14 }),
        noHistory
      )
    ).toBeNull();
  });
});

describe("planTask", () => {
  it("fires once the countdown has elapsed", () => {
    // Launched 1 April, rule is 30 days, now is 15 June — well past due.
    expect(planTask(client(), rule(), noHistory, NOW)).toEqual({
      title: "Pitch brand curation package to Sunrise Cafe",
    });
  });

  it("stays silent before the countdown elapses", () => {
    const justLaunched = client({ websiteLaunchDate: new Date("2026-06-10T00:00:00Z") });
    expect(planTask(justLaunched, rule(), noHistory, NOW)).toBeNull();
  });

  it("fires exactly on the boundary day, not a day late", () => {
    // 30 days after 16 May is 15 June. An off-by-one here would delay every
    // reminder in the system by a day, invisibly.
    const launched = client({ websiteLaunchDate: new Date("2026-05-16T12:00:00Z") });
    expect(planTask(launched, rule(), noHistory, NOW)).not.toBeNull();
  });

  it("skips a client in a different tier", () => {
    expect(planTask(client({ currentTier: "BRAND_CURATION" }), rule(), noHistory, NOW)).toBeNull();
  });

  it("matches any tier when triggerTier is null", () => {
    const anyTier = rule({
      triggerTier: null,
      anchor: "RETAINER_START",
      daysAfterTrigger: 90,
    });
    const withRetainer = client({
      currentTier: "ANALYTICS",
      retainers: [
        { status: "ACTIVE", startDate: new Date("2026-01-01T00:00:00Z"), endDate: null },
      ],
    });
    expect(planTask(withRetainer, anyTier, noHistory, NOW)).not.toBeNull();
  });

  it("does not stack a second copy while one is still open — the idempotency guard", () => {
    const withLiveTask = client({
      tasks: [
        { id: "t1", sourceRuleId: "rule-1", status: "OPEN", createdAt: new Date("2026-05-01") },
      ],
    });
    expect(planTask(withLiveTask, rule(), noHistory, NOW)).toBeNull();
  });

  it("fires again once the previous task is done", () => {
    const withDoneTask = client({
      tasks: [
        { id: "t1", sourceRuleId: "rule-1", status: "DONE", createdAt: new Date("2026-05-01") },
      ],
    });
    expect(planTask(withDoneTask, rule(), noHistory, NOW)).not.toBeNull();
  });

  it("is not blocked by an open task from a different rule", () => {
    const otherRuleTask = client({
      tasks: [
        { id: "t1", sourceRuleId: "rule-99", status: "OPEN", createdAt: new Date("2026-05-01") },
      ],
    });
    expect(planTask(otherRuleTask, rule(), noHistory, NOW)).not.toBeNull();
  });

  it("skips a requiresActiveRetainer rule when the client has none", () => {
    const checkIn = rule({
      triggerTier: null,
      anchor: "RETAINER_START",
      requiresActiveRetainer: true,
      repeatEveryDays: 90,
    });
    expect(planTask(client({ retainers: [] }), checkIn, noHistory, NOW)).toBeNull();
  });

  it("counts a recurring rule from its last task, not the original anchor", () => {
    // The quarterly check-in must restart its clock each cycle. Anchoring off the
    // retainer start forever would make it fire every single day once the first
    // 90 days had passed.
    const checkIn = rule({
      triggerTier: null,
      anchor: "RETAINER_START",
      requiresActiveRetainer: true,
      repeatEveryDays: 90,
      daysAfterTrigger: 90,
    });
    const base = {
      retainers: [
        { status: "ACTIVE", startDate: new Date("2025-01-01T00:00:00Z"), endDate: null },
      ],
    };

    const checkedInRecently = client({
      ...base,
      tasks: [
        { id: "t1", sourceRuleId: "rule-1", status: "DONE", createdAt: new Date("2026-05-01") },
      ],
    });
    expect(planTask(checkedInRecently, checkIn, noHistory, NOW)).toBeNull();

    const checkedInLongAgo = client({
      ...base,
      tasks: [
        { id: "t1", sourceRuleId: "rule-1", status: "DONE", createdAt: new Date("2026-01-01") },
      ],
    });
    expect(planTask(checkedInLongAgo, checkIn, noHistory, NOW)).not.toBeNull();
  });

  it("renders the business name into the task title", () => {
    const plan = planTask(client({ businessName: "Pennfield Pizza" }), rule(), noHistory, NOW);
    expect(plan?.title).toBe("Pitch brand curation package to Pennfield Pizza");
  });
});

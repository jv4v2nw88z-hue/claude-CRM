/**
 * End-to-end lifecycle check (spec §12, Phase 7).
 *
 * Drives a throwaway client through the whole service ladder against a running
 * API, backdating anchor dates so every automation rule gets a chance to fire,
 * and asserting MRR moves exactly when a retainer's status says it should.
 *
 * Usage: npm run qa:lifecycle   (server must be running on $QA_BASE_URL)
 * Creates and then deletes its own data — safe to run against a seeded dev DB.
 */

import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:4000";
const EMAIL = process.env.QA_EMAIL ?? "cole@midigitalexpansion.com";
const PASSWORD = process.env.QA_PASSWORD ?? "changeme123";
const BUSINESS_NAME = `QA Lifecycle ${Date.now()}`;

const prisma = new PrismaClient();

let cookie = "";
let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...init.headers,
    },
  });

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];

  if (res.status === 204) return undefined as T;
  const body = await res.json();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${JSON.stringify(body)}`);
  return body as T;
}

const post = <T>(path: string, body?: unknown) =>
  call<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  call<T>(path, { method: "PATCH", body: JSON.stringify(body) });

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/** Pushes the rule's anchor into the past so the countdown has already elapsed. */
async function backdateLaunch(clientId: string, days: number) {
  await prisma.client.update({
    where: { id: clientId },
    data: { websiteLaunchDate: daysAgo(days) },
  });
}

async function backdateTierEntry(clientId: string, tier: string, days: number) {
  const entry = await prisma.serviceHistoryEntry.findFirst({
    where: { clientId, toTier: tier as never },
    orderBy: { changedAt: "desc" },
  });
  if (entry) {
    await prisma.serviceHistoryEntry.update({
      where: { id: entry.id },
      data: { changedAt: daysAgo(days) },
    });
  }
}

async function runAutomation() {
  return post<{ tasksCreated: { title: string }[] }>("/automation-rules/run");
}

async function openTaskTitles(clientId: string): Promise<string[]> {
  const tasks = await prisma.task.findMany({
    where: { clientId, status: { in: ["OPEN", "IN_PROGRESS", "SNOOZED"] } },
  });
  return tasks.map((t) => t.title);
}

async function totalMrr(): Promise<number> {
  const summary = await call<{ totalMRR: number }>("/dashboard/summary");
  return summary.totalMRR;
}

async function main() {
  console.log(`Lifecycle check against ${BASE_URL}\n`);

  // --- Auth ---------------------------------------------------------------
  console.log("Auth");
  const login = await post<{ user: { id: string; name: string } }>("/auth/login", {
    email: EMAIL,
    password: PASSWORD,
  });
  check("logs in and receives a session cookie", Boolean(cookie) && Boolean(login.user.id));

  const me = await call<{ user: { email: string } }>("/auth/me");
  check("session resolves the current user", me.user.email === EMAIL);

  // --- Deal -> Client -----------------------------------------------------
  console.log("\nDeal → Client");
  const deal = await post<{ id: string; stage: string }>("/deals", {
    businessName: BUSINESS_NAME,
    contactName: "Jamie Rivera",
    contactEmail: "jamie@qa.example.com",
    source: "referral",
    estimatedValue: 3000,
  });
  check("creates a deal in the New stage", deal.stage === "New");

  const client = await post<{ id: string; currentTier: string }>(`/deals/${deal.id}/convert`, {});
  check("converts the deal into a client at Website Build", client.currentTier === "WEBSITE_BUILD");

  const convertedDeal = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } });
  check("marks the deal Won and links it to the client", convertedDeal.stage === "Won" && convertedDeal.clientId === client.id);

  const carriedContact = await prisma.contact.findFirst({ where: { clientId: client.id } });
  check("carries the deal's contact onto the client", carriedContact?.firstName === "Jamie");

  // --- Website launch -----------------------------------------------------
  console.log("\nTier: Website Build → Website Live");
  await patch(`/clients/${client.id}/tier`, { newTier: "WEBSITE_LIVE" });
  const live = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
  check("auto-populates websiteLaunchDate on going live", live.websiteLaunchDate !== null);

  const history = await prisma.serviceHistoryEntry.findMany({ where: { clientId: client.id } });
  check("writes an audit row for every tier change", history.length === 2, history.map((h) => h.toTier));

  // --- Rule: pitch brand curation at 30 days ------------------------------
  console.log("\nAutomation: 30 days post-launch");
  await backdateLaunch(client.id, 31);
  await runAutomation();
  let titles = await openTaskTitles(client.id);
  check(
    "raises the brand curation pitch",
    titles.some((t) => t.includes("Pitch brand curation package to")),
    titles
  );

  await runAutomation();
  const afterRerun = await openTaskTitles(client.id);
  check("does not duplicate the task on a second run", afterRerun.length === titles.length);

  // --- Rule: escalate at 60 days ------------------------------------------
  console.log("\nAutomation: 60 days post-launch");
  await backdateLaunch(client.id, 61);
  await runAutomation();
  titles = await openTaskTitles(client.id);
  check(
    "escalates the unpitched client",
    titles.some((t) => t.startsWith("URGENT:")),
    titles
  );

  // --- At-risk detection --------------------------------------------------
  const summary = await call<{ atRiskClients: { clientId: string }[] }>("/dashboard/summary");
  check(
    "surfaces the client in the at-risk panel",
    summary.atRiskClients.some((c) => c.clientId === client.id)
  );

  // --- Retainer -> MRR ----------------------------------------------------
  console.log("\nRevenue");
  const mrrBefore = await totalMrr();
  const retainer = await post<{ id: string; status: string }>(`/clients/${client.id}/retainers`, {
    tier: "BRAND_CURATION",
    monthlyAmount: 600,
    status: "ACTIVE",
  });
  const mrrAfter = await totalMrr();
  check("an active retainer adds its amount to MRR", mrrAfter === mrrBefore + 600, {
    mrrBefore,
    mrrAfter,
  });

  const stillAtRisk = await call<{ atRiskClients: { clientId: string }[] }>("/dashboard/summary");
  check(
    "an active retainer clears the at-risk flag",
    !stillAtRisk.atRiskClients.some((c) => c.clientId === client.id)
  );

  await patch(`/retainers/${retainer.id}`, { status: "PAUSED" });
  const mrrPaused = await totalMrr();
  check("a paused retainer drops out of MRR", mrrPaused === mrrBefore, { mrrPaused, mrrBefore });

  await patch(`/retainers/${retainer.id}`, { status: "ACTIVE" });
  check("reactivating restores MRR", (await totalMrr()) === mrrBefore + 600);

  // --- Tier change retires the old tier's nags ----------------------------
  console.log("\nTier: Website Live → Brand Curation");
  await patch(`/clients/${client.id}/tier`, { newTier: "BRAND_CURATION" });
  const cancelled = await prisma.task.findMany({
    where: { clientId: client.id, autoGenerated: true, status: "CANCELLED" },
  });
  check("cancels the stale Website Live upsell tasks", cancelled.length >= 2, cancelled.length);

  const survivingOpen = await openTaskTitles(client.id);
  check("leaves no orphaned Website Live nags open", !survivingOpen.some((t) => t.startsWith("URGENT:")));

  // --- Rule: pitch social at 45 days --------------------------------------
  console.log("\nAutomation: 45 days at Brand Curation");
  await backdateTierEntry(client.id, "BRAND_CURATION", 46);
  await runAutomation();
  titles = await openTaskTitles(client.id);
  check(
    "raises the social media pitch",
    titles.some((t) => t.includes("Pitch social media management to")),
    titles
  );

  // --- Rule: pitch analytics at 60 days -----------------------------------
  console.log("\nAutomation: 60 days at Social Media");
  await patch(`/clients/${client.id}/tier`, { newTier: "SOCIAL_MEDIA" });
  await backdateTierEntry(client.id, "SOCIAL_MEDIA", 61);
  await runAutomation();
  titles = await openTaskTitles(client.id);
  check(
    "raises the analytics pitch",
    titles.some((t) => t.includes("Pitch analytics package to")),
    titles
  );

  // --- Rule: quarterly check-in -------------------------------------------
  console.log("\nAutomation: quarterly check-in");
  await prisma.retainer.update({
    where: { id: retainer.id },
    data: { startDate: daysAgo(91) },
  });
  await runAutomation();
  titles = await openTaskTitles(client.id);
  check(
    "raises the quarterly check-in for an active retainer",
    titles.some((t) => t.includes("Quarterly check-in call with")),
    titles
  );

  // --- Rule: contract renewal 14 days before expiry -----------------------
  console.log("\nAutomation: contract renewal");
  const expiringSoon = new Date();
  expiringSoon.setDate(expiringSoon.getDate() + 10); // inside the 14-day window
  await prisma.retainer.update({ where: { id: retainer.id }, data: { endDate: expiringSoon } });
  await runAutomation();
  titles = await openTaskTitles(client.id);
  check(
    "raises the contract renewal reminder",
    titles.some((t) => t.includes("Renew contract with")),
    titles
  );

  // --- Top of the ladder --------------------------------------------------
  console.log("\nTier: Social Media → Analytics");
  const atTop = await patch<{ currentTier: string }>(`/clients/${client.id}/tier`, {
    newTier: "ANALYTICS",
  });
  check("reaches the top of the ladder", atTop.currentTier === "ANALYTICS");

  // --- Churn --------------------------------------------------------------
  console.log("\nChurn");
  await patch(`/retainers/${retainer.id}`, { status: "CANCELLED" });
  const mrrAfterChurn = await totalMrr();
  check("a cancelled retainer leaves MRR", mrrAfterChurn === mrrBefore, { mrrAfterChurn, mrrBefore });

  const revenue = await call<{ lostThisQuarter: number }>("/dashboard/revenue");
  check("cancelled revenue shows up as lost this quarter", revenue.lostThisQuarter >= 600, revenue.lostThisQuarter);

  // --- Task completion ----------------------------------------------------
  console.log("\nTasks");
  const anyOpen = await prisma.task.findFirst({
    where: { clientId: client.id, status: "OPEN" },
  });
  if (anyOpen) {
    const completed = await post<{ status: string; completedAt: string | null }>(
      `/tasks/${anyOpen.id}/complete`
    );
    check("completing a task stamps status and completedAt", completed.status === "DONE" && completed.completedAt !== null);
  }

  // --- Interactions -------------------------------------------------------
  const interaction = await post<{ id: string; loggedById: string | null }>(
    `/clients/${client.id}/interactions`,
    { type: "CALL", summary: "QA lifecycle call" }
  );
  check("logs an interaction against the signed-in user", interaction.loggedById === login.user.id);

  // --- Soft delete --------------------------------------------------------
  await call(`/clients/${client.id}`, { method: "DELETE" });
  const roster = await call<{ id: string }[]>("/clients");
  check("deleting a client removes it from the roster but keeps the row", !roster.some((c) => c.id === client.id));
  const stillThere = await prisma.client.findUnique({ where: { id: client.id } });
  check("the client row survives as an inactive record", stillThere !== null && stillThere.isActive === false);

  // --- Cleanup ------------------------------------------------------------
  await prisma.deal.deleteMany({ where: { id: deal.id } });
  await prisma.client.delete({ where: { id: client.id } });
  console.log("\nCleaned up QA data.");
}

main()
  .then(() => {
    console.log(`\n${passed} passed, ${failures.length} failed`);
    if (failures.length > 0) {
      console.log("Failures:");
      failures.forEach((f) => console.log(`  - ${f}`));
      process.exitCode = 1;
    }
  })
  .catch((err) => {
    console.error("\nLifecycle check crashed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

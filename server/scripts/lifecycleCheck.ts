/**
 * End-to-end lifecycle check (spec §12, Phase 7).
 *
 * Drives a throwaway client through the whole service ladder against a running
 * Worker, backdating anchor dates so every automation rule gets a chance to fire,
 * and asserting MRR moves exactly when a retainer's status says it should.
 *
 * Usage: npm run qa:lifecycle    (needs `npm run dev` running on $QA_BASE_URL)
 *
 * On Postgres this opened a second connection and manipulated rows directly.
 * D1 is only reachable from inside the Worker, so everything here goes over
 * HTTP — which means the check now exercises the real API surface. The two
 * things the public API genuinely cannot express (backdating a tier-history row,
 * hard deleting a client) go through the QA hooks at /api/qa, which mount only
 * when QA_HOOKS_ENABLED=true in .dev.vars.
 *
 * Creates and then deletes its own data — safe to run against a seeded dev DB.
 */

const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:8787";
const EMAIL = process.env.QA_EMAIL ?? "cole@midigitalexpansion.com";
const PASSWORD = process.env.QA_PASSWORD ?? "changeme123";
const BUSINESS_NAME = `QA Lifecycle ${Date.now()}`;

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
      ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...init.headers,
    },
  });

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];

  if (res.status === 204) return undefined as T;
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

const post = <T>(path: string, body?: unknown) =>
  call<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  call<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = <T>(path: string) => call<T>(path, { method: "DELETE" });

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

interface ClientDetail {
  id: string;
  currentTier: string;
  websiteLaunchDate: string | null;
  isActive: boolean;
  contacts: { firstName: string }[];
  serviceHistory: { toTier: string }[];
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  completedAt: string | null;
}

const clientDetail = (id: string) => call<ClientDetail>(`/clients/${id}`);

/** Pushes the launch anchor into the past through the ordinary update endpoint. */
const backdateLaunch = (clientId: string, days: number) =>
  patch(`/clients/${clientId}`, { websiteLaunchDate: daysAgo(days).toISOString() });

/** Tier-history rows have no public write path, so this uses the QA hook. */
const backdateTierEntry = (clientId: string, toTier: string, days: number) =>
  post("/qa/backdate-tier-entry", { clientId, toTier, changedAt: daysAgo(days).toISOString() });

const runAutomation = () => post<{ tasksCreated: { title: string }[] }>("/automation-rules/run");

async function tasksFor(clientId: string, query = ""): Promise<TaskRow[]> {
  return call<TaskRow[]>(`/tasks?clientId=${clientId}${query}`);
}

async function openTaskTitles(clientId: string): Promise<string[]> {
  return (await tasksFor(clientId)).map((t) => t.title);
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

  const deals = await call<{ id: string; stage: string; clientId: string | null }[]>("/deals");
  const convertedDeal = deals.find((d) => d.id === deal.id);
  check(
    "marks the deal Won and links it to the client",
    convertedDeal?.stage === "Won" && convertedDeal?.clientId === client.id
  );

  const afterConvert = await clientDetail(client.id);
  check("carries the deal's contact onto the client", afterConvert.contacts[0]?.firstName === "Jamie");

  // --- Website launch -----------------------------------------------------
  console.log("\nTier: Website Build → Website Live");
  await patch(`/clients/${client.id}/tier`, { newTier: "WEBSITE_LIVE" });
  const live = await clientDetail(client.id);
  check("auto-populates websiteLaunchDate on going live", live.websiteLaunchDate !== null);
  check(
    "writes an audit row for every tier change",
    live.serviceHistory.length === 2,
    live.serviceHistory.map((h) => h.toTier)
  );

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
  const cancelled = await tasksFor(client.id, "&status=CANCELLED");
  check("cancels the stale Website Live upsell tasks", cancelled.length >= 2, cancelled.length);

  const survivingOpen = await openTaskTitles(client.id);
  check(
    "leaves no orphaned Website Live nags open",
    !survivingOpen.some((t) => t.startsWith("URGENT:"))
  );

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
  await patch(`/retainers/${retainer.id}`, { startDate: daysAgo(91).toISOString() });
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
  await patch(`/retainers/${retainer.id}`, { endDate: expiringSoon.toISOString() });
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
  check("a cancelled retainer leaves MRR", mrrAfterChurn === mrrBefore, {
    mrrAfterChurn,
    mrrBefore,
  });

  const revenue = await call<{ lostThisQuarter: number }>("/dashboard/revenue");
  check(
    "cancelled revenue shows up as lost this quarter",
    revenue.lostThisQuarter >= 600,
    revenue.lostThisQuarter
  );

  // --- Task completion ----------------------------------------------------
  console.log("\nTasks");
  const openTasks = await tasksFor(client.id, "&status=OPEN");
  if (openTasks.length > 0) {
    const completed = await post<TaskRow>(`/tasks/${openTasks[0].id}/complete`);
    check(
      "completing a task stamps status and completedAt",
      completed.status === "DONE" && completed.completedAt !== null
    );
  }

  // --- Interactions -------------------------------------------------------
  const interaction = await post<{ id: string; loggedById: string | null }>(
    `/clients/${client.id}/interactions`,
    { type: "CALL", summary: "QA lifecycle call" }
  );
  check("logs an interaction against the signed-in user", interaction.loggedById === login.user.id);

  // --- Documents ----------------------------------------------------------
  const storage = await call<{ storageEnabled: boolean }>("/documents/config");
  if (storage.storageEnabled) {
    const form = new FormData();
    form.append("file", new File(["QA contract body"], "qa-contract.txt", { type: "text/plain" }));
    form.append("category", "contract");
    const uploaded = await call<{ id: string; storageKey: string | null }>(
      `/clients/${client.id}/documents`,
      { method: "POST", body: form }
    );
    check("uploads a document into R2", Boolean(uploaded.storageKey));

    const fetched = await fetch(`${BASE_URL}/api/documents/${uploaded.id}/content`, {
      headers: { Cookie: cookie },
    });
    check("reads the document back out of R2", (await fetched.text()) === "QA contract body");

    await del(`/documents/${uploaded.id}`);
  }

  // --- Soft delete --------------------------------------------------------
  await del(`/clients/${client.id}`);
  const roster = await call<{ id: string }[]>("/clients");
  check(
    "deleting a client removes it from the roster but keeps the row",
    !roster.some((c) => c.id === client.id)
  );
  const stillThere = await clientDetail(client.id);
  check("the client row survives as an inactive record", stillThere.isActive === false);

  // --- Cleanup ------------------------------------------------------------
  await del(`/deals/${deal.id}`);
  await del(`/qa/clients/${client.id}`);
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
  });

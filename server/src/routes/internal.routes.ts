import { Hono } from "hono";
import { runAutomationEngine } from "../jobs/automationEngine";
import { runSeed } from "../seed/seedData";
import type { AppEnv } from "../types";

/**
 * Machine-facing endpoints, mounted at /api/internal and deliberately outside
 * the session cookie: each is guarded by its own shared secret instead.
 *
 * Both refuse to run when their secret is unset, so an unconfigured deployment
 * exposes nothing rather than exposing an open endpoint.
 */
const router = new Hono<AppEnv>();

function checkSecret(provided: string | undefined, expected: string | undefined): boolean {
  return Boolean(expected) && provided === expected;
}

/**
 * The 6am Cron Trigger is the normal path; this exists so the engine can also be
 * fired from outside (a manual curl, an uptime check, a second schedule) without
 * a browser session.
 */
router.post("/run-automation", async (c) => {
  if (!checkSecret(c.req.header("x-automation-secret"), c.env.AUTOMATION_SECRET)) {
    return c.json({ error: "Not authorised" }, 401);
  }
  return c.json(await runAutomationEngine(c.get("prisma"), c.env));
});

/**
 * Seeds users, automation rules and the five founding clients. Safe to re-run:
 * users and rules upsert, and client data is skipped entirely once any client
 * exists, so this can never duplicate the roster.
 */
router.post("/seed", async (c) => {
  if (!checkSecret(c.req.header("x-seed-secret"), c.env.SEED_SECRET)) {
    return c.json({ error: "Not authorised" }, 401);
  }
  return c.json(await runSeed(c.get("prisma"), c.env));
});

export default router;

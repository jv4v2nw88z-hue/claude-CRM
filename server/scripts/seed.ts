/**
 * Seeds the database by calling the Worker.
 *
 * D1 has no connection string, so unlike the Postgres version this cannot open
 * the database itself — the seed logic lives in the Worker (src/seed/seedData.ts)
 * and this just triggers it over HTTP with the shared secret.
 *
 *   npm run seed:local                    # against `wrangler dev` on :8787
 *   npm run seed:remote                   # against the deployed Worker
 *
 * For --remote, set CRM_URL to the Worker's URL and SEED_SECRET to the value you
 * gave `wrangler secret put SEED_SECRET`.
 */

import fs from "node:fs";
import path from "node:path";

const remote = process.argv.includes("--remote");

/** Local secrets live in .dev.vars, which is not a JS module — parse it directly. */
function readDevVar(key: string): string | undefined {
  // The config lives at the repo root, so wrangler reads .dev.vars from there too.
  const file = path.resolve(import.meta.dirname, "..", "..", ".dev.vars");
  if (!fs.existsSync(file)) return undefined;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (match && match[1] === key) return match[2].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const baseUrl = (
  remote ? process.env.CRM_URL : process.env.CRM_URL ?? "http://localhost:8787"
)?.replace(/\/$/, "");

const secret = remote ? process.env.SEED_SECRET : process.env.SEED_SECRET ?? readDevVar("SEED_SECRET");

if (!baseUrl) {
  console.error("Set CRM_URL to your Worker's URL, e.g.\n  CRM_URL=https://midigitalexpansion-crm.<subdomain>.workers.dev npm run seed:remote");
  process.exit(1);
}
if (!secret) {
  console.error(
    remote
      ? "Set SEED_SECRET to the value you passed to `npx wrangler secret put SEED_SECRET`."
      : "No SEED_SECRET found. Copy .dev.vars.example to .dev.vars first."
  );
  process.exit(1);
}

const res = await fetch(`${baseUrl}/api/internal/seed`, {
  method: "POST",
  headers: { "x-seed-secret": secret },
});

const body = await res.json().catch(() => ({}) as Record<string, unknown>);

if (!res.ok) {
  console.error(`Seed failed (${res.status}):`, body);
  process.exit(1);
}

const result = body as {
  message?: string;
  rulesSeeded?: number;
  clientsSeeded?: number;
  credentials?: Array<{ email: string; password: string }>;
};
console.log(`Seeding ${baseUrl}`);
console.log(`  automation rules created: ${result.rulesSeeded ?? 0}`);
console.log(`  clients created:          ${result.clientsSeeded ?? 0}`);
console.log(`  ${result.message ?? "Done."}`);

/**
 * The only time these values are ever visible. They are generated inside the
 * Worker, hashed immediately, and never stored in plaintext — so this output is
 * not a convenience, it is the sole handoff. Printed to stdout rather than
 * written to a file so it does not end up committed.
 */
if (result.credentials?.length) {
  console.log("\n  ─── First-time sign-in — save these now, they are not recoverable ───");
  for (const { email, password } of result.credentials) {
    console.log(`    ${email}`);
    console.log(`      password: ${password}`);
  }
  console.log("  Each account must set a new password on first sign-in.\n");
}

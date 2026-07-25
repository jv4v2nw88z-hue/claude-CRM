/**
 * Generates the next D1 migration from the current Prisma schema.
 *
 * Usage:  npm run migrate:new -- add_client_tags
 *
 * `prisma migrate dev` cannot be used here: it wants to connect to the database
 * it is migrating, and D1 is only reachable through a Worker binding. So instead
 * this replays every migration already in ./migrations into a scratch SQLite
 * file, diffs the schema against that, and writes the difference out as the next
 * numbered .sql file for `wrangler d1 migrations apply` to run.
 */

import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve("migrations");
const SCRATCH_DB = path.resolve(".prisma-diff-shadow.db");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const rawName = process.argv[2];
if (!rawName) {
  fail("Usage: npm run migrate:new -- <migration_name>\n  e.g. npm run migrate:new -- add_client_tags");
}
const name = rawName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
if (!name) fail(`"${rawName}" does not contain any usable characters for a filename.`);

const existing = fs.existsSync(MIGRATIONS_DIR)
  ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()
  : [];

// Replay the migration history into a throwaway database so the diff is against
// the schema D1 actually has, not against nothing.
fs.rmSync(SCRATCH_DB, { force: true });
const shadow = new DatabaseSync(SCRATCH_DB);
try {
  for (const file of existing) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      shadow.exec(sql);
    } catch (err) {
      fail(`Failed replaying ${file} into the scratch database:\n  ${String(err)}`);
    }
  }
} finally {
  shadow.close();
}

const nextNumber = String(existing.length + 1).padStart(4, "0");
const outFile = path.join(MIGRATIONS_DIR, `${nextNumber}_${name}.sql`);

execFileSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    path.join("prisma", "schema.prisma"),
    "--script",
    "--output",
    outFile,
  ],
  {
    stdio: "inherit",
    env: { ...process.env, PRISMA_DIFF_DATABASE_URL: `file:${SCRATCH_DB}` },
  }
);

fs.rmSync(SCRATCH_DB, { force: true });

const written = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8").trim() : "";

// An unchanged schema still produces a file — just one holding a lone
// "-- This is an empty migration." comment. Strip comments and blank lines to
// tell a real migration from that, so a no-op run leaves nothing behind for
// `wrangler d1 migrations apply` to pick up.
const hasStatements = written
  .split("\n")
  .some((line) => line.trim() !== "" && !line.trim().startsWith("--"));

if (!hasStatements) {
  fs.rmSync(outFile, { force: true });
  console.log("No schema changes — nothing to migrate.");
  process.exit(0);
}

console.log(`\nWrote ${path.relative(process.cwd(), outFile)}:\n`);
console.log(written.split("\n").map((l) => `  ${l}`).join("\n"));
console.log(`\nApply it with:\n  npm run migrate:local\n  npm run migrate:remote`);

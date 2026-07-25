/**
 * Install the workspace dependencies if they are missing.
 *
 * The repo root has no dependencies of its own, so a CI provider that runs its
 * install step at the root (Cloudflare Workers Builds picks `bun install`) does
 * nothing useful and leaves `client/` and `server/` empty. The first build step
 * then dies on `tsc: not found`, which reads like a missing devDependency rather
 * than a missing install.
 *
 * Running this before any build makes the build self-sufficient: a no-op on a
 * developer machine, and the real install in CI. Checking for a known binary
 * rather than the directory means a partial or interrupted install is repaired
 * rather than trusted.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** A binary each workspace must have for its build to run at all. */
const WORKSPACES = [
  { dir: "client", sentinel: join("node_modules", ".bin", "tsc") },
  { dir: "server", sentinel: join("node_modules", ".bin", "wrangler") },
];

for (const { dir, sentinel } of WORKSPACES) {
  if (existsSync(join(root, dir, sentinel))) continue;

  // `ci` for reproducibility — both lockfiles are committed. It also clears any
  // half-written node_modules, which is why the sentinel check is a binary.
  console.log(`[ensure:deps] installing ${dir}`);
  const result = spawnSync("npm", ["ci", "--prefix", dir], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`[ensure:deps] npm ci failed in ${dir}`);
    process.exit(result.status ?? 1);
  }
}

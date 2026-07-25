import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * The Worker never reads any of this — at runtime the connection comes from the
 * `PrismaD1` adapter wrapping the D1 binding (see src/config/db.ts). This file
 * exists purely so `prisma migrate diff` has somewhere to point while it renders
 * schema changes into SQL, which `wrangler d1 migrations apply` then runs
 * against the real database.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),

  // Wrangler owns this directory (`migrations_dir` in wrangler.jsonc); Prisma
  // only writes generated SQL into it.
  migrations: {
    path: path.join("migrations"),
  },

  datasource: {
    // A throwaway local file. `migrate diff --from-empty` never connects to it,
    // but the schema engine wants a SQLite target to render dialect-correct DDL.
    //
    // `scripts/makeMigration.ts` overrides this to point at a scratch database
    // with every existing migration replayed into it, which is how an
    // incremental migration gets diffed without a live D1 connection.
    url: process.env.PRISMA_DIFF_DATABASE_URL ?? "file:./.prisma-diff.db",
  },
});

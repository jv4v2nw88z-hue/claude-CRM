import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure functions only.
 *
 * Deliberately plain Node, not the Workers pool: everything under test here —
 * MRR arithmetic, anchor-date computation — takes plain objects and returns
 * values, with no D1, no bindings and no fetch. Running them in a Worker
 * runtime would buy nothing and cost startup time on every run, and the
 * integration surface is already covered end-to-end by qa:lifecycle against a
 * real Worker.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The generated Prisma client is large and has no tests of its own.
    exclude: ["src/generated/**", "node_modules/**"],
  },
});

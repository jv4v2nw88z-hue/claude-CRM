import type { PrismaClient } from "./generated/prisma/client";
import type { UserRole } from "./domain/enums";

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/**
 * The Hono context shape for the whole app.
 *
 * `Bindings` is the Worker's `Env` (D1, R2, assets, vars and secrets), generated
 * into worker-configuration.d.ts by `wrangler types`. `prisma` is set once per
 * request by the middleware in app.ts — a Worker has no process-wide singleton
 * to hang a database client off, so it travels on the context instead.
 */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    prisma: PrismaClient;
    user: AuthedUser | null;
  };
};

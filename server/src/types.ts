import type { PrismaClient } from "./generated/prisma/client";
import type { UserRole } from "./domain/enums";

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Drives the client-side gate that forces a reset before anything else renders. */
  mustChangePassword: boolean;
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
    /**
     * Why the current request was allowed to write to a client, set by
     * requireClientAccess. Lets a handler tell an owner's edit apart from a
     * TECHNICAL override without re-resolving access.
     */
    accessReason: "TECHNICAL_OVERRIDE" | "OWNER" | "DELEGATED" | null;
  };
};

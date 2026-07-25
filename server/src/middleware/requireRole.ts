import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import type { UserRole } from "../domain/enums";

/**
 * Role gate for destructive and configuration-changing routes.
 *
 * Until now `requireAuth` established *who* you are and nothing checked what you
 * were allowed to do, so any signed-in account could delete every client or
 * switch off the automation engine — the engine being the one thing this app
 * exists to run. With two trusted people that was a latent problem; it becomes a
 * live one the moment a third account exists.
 *
 * Mount it after `requireAuth`, which is what puts the user on the context. It
 * fails closed: no user means 401, not "skip the check".
 */
export function requireRole(...allowed: UserRole[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Not authenticated" }, 401);

    if (!allowed.includes(user.role)) {
      // 403, not 404: the caller is legitimately authenticated and the resource
      // exists — hiding that would only make the UI harder to explain.
      return c.json(
        {
          error: `This action needs the ${allowed.join(" or ")} role. You are signed in as ${user.role}.`,
        },
        403
      );
    }

    await next();
  });
}

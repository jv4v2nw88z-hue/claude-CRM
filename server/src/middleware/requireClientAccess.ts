import { createMiddleware } from "hono/factory";
import { resolveClientAccess, type AccessReason } from "../services/accessService";
import { logTechnicalOverride } from "../services/auditService";
import type { AppEnv } from "../types";

/**
 * Gates writes to a client (and to deals belonging to one).
 *
 * Mount after `requireAuth`. Resolves the client id from the route — `:clientId`
 * on nested routers, `:id` on the client router itself — so the same middleware
 * serves both shapes without each route restating it.
 *
 * The access decision is put on the context as `accessReason`, so a handler can
 * see *why* it was allowed without asking again. That is what lets the audit log
 * distinguish an owner's edit from an admin override.
 */
/**
 * Same gate, for routes whose client is reached through a deal.
 *
 * A deal's `clientId` is on the record rather than in the path, and it is
 * nullable — an unconverted prospect belongs to nobody yet. Those stay open:
 * gating them would make the pipeline unusable for the person whose job it is to
 * work it, and there is no client relationship to protect until conversion.
 */
export function requireDealClientAccess() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Not authenticated" }, 401);

    const dealId = c.req.param("id");
    if (!dealId) return c.json({ error: "Missing id in the request path" }, 400);

    const deal = await c
      .get("prisma")
      .deal.findUnique({ where: { id: dealId }, select: { clientId: true } });

    // No deal, or not yet converted: nothing to gate. A missing deal falls
    // through to the handler's own 404 rather than being masked as a 403.
    if (!deal?.clientId) return next();

    const decision = await resolveClientAccess(c.get("prisma"), deal.clientId, user);
    if (!decision.allowed) {
      return c.json(
        { error: "You don't have write access to the client this deal belongs to." },
        403
      );
    }

    c.set("accessReason", decision.reason as AccessReason);

    if (decision.reason === "TECHNICAL_OVERRIDE") {
      await logTechnicalOverride(c.get("prisma"), deal.clientId, user.id, {
        method: c.req.method,
        path: new URL(c.req.url).pathname,
      });
    }

    await next();
  });
}

export function requireClientAccess(paramName: "id" | "clientId" = "clientId") {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Not authenticated" }, 401);

    const clientId = c.req.param(paramName);
    if (!clientId) return c.json({ error: `Missing ${paramName} in the request path` }, 400);

    const decision = await resolveClientAccess(c.get("prisma"), clientId, user);

    if (!decision.allowed) {
      return c.json(
        {
          error:
            "You don't have write access to this client. Ask its owner to add you, " +
            "or ask Brian to make the change.",
        },
        403
      );
    }

    c.set("accessReason", decision.reason as AccessReason);

    /*
     * Every TECHNICAL override is recorded, every time — not sampled, not only
     * when it looks unusual. The value of the record is that it is complete: a
     * gap in it is indistinguishable from an override that never happened, and
     * "there were only two accounts at the time" is exactly the assumption that
     * stops being true without anyone revisiting the logging.
     *
     * Logged before the handler runs, so an override is recorded even if the
     * write it authorised then fails. This records the exercise of privilege,
     * which happened either way; the field-level log records the change.
     */
    if (decision.reason === "TECHNICAL_OVERRIDE") {
      await logTechnicalOverride(c.get("prisma"), clientId, user.id, {
        method: c.req.method,
        path: new URL(c.req.url).pathname,
      });
    }

    await next();
  });
}

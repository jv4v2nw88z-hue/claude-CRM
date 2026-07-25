import { Hono } from "hono";
import { cors } from "hono/cors";
import { areQaHooksEnabled, corsOrigins } from "./config/env";
import { createPrisma } from "./config/db";
import { toErrorResponse } from "./lib/http";
import { requireAuth } from "./middleware/requireAuth";
import type { AppEnv } from "./types";

import authRoutes from "./routes/auth.routes";
import internalRoutes from "./routes/internal.routes";
import qaRoutes from "./routes/qa.routes";
import clientsRoutes from "./routes/clients.routes";
import { clientContactsRouter, contactsRouter } from "./routes/contacts.routes";
import { clientRetainersRouter, retainersRouter } from "./routes/retainers.routes";
import tasksRoutes from "./routes/tasks.routes";
import { clientInteractionsRouter, interactionsRouter } from "./routes/interactions.routes";
import dealsRoutes from "./routes/deals.routes";
import { clientDocumentsRouter, documentsRouter } from "./routes/documents.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import automationRulesRoutes from "./routes/automationRules.routes";
import usersRoutes from "./routes/users.routes";

export function createApp() {
  const app = new Hono<AppEnv>();

  // One Prisma client per request — see config/db.ts for why there is no singleton.
  app.use("*", async (c, next) => {
    c.set("prisma", createPrisma(c.env.DB));
    c.set("user", null);
    await next();
  });

  // The Worker serves the React build from the same origin, so CORS is normally
  // dead weight. It switches on only if CORS_ORIGIN names an origin, for the
  // case where the frontend is hosted somewhere else.
  app.use("/api/*", async (c, next) => {
    const origins = corsOrigins(c.env);
    if (origins.length === 0) return next();
    return cors({ origin: origins, credentials: true })(c, next);
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  // Secret-guarded, no session required.
  app.route("/api/internal", internalRoutes);

  // Session issue/refresh/teardown — must stay outside the auth wall.
  app.route("/api/auth", authRoutes);

  // ---- Everything below requires a session -------------------------------
  const api = new Hono<AppEnv>();
  api.use("*", requireAuth);

  // Nested collections first, so /clients/:clientId/contacts is matched before
  // the /clients router gets a chance to treat "contacts" as an :id.
  api.route("/clients/:clientId/contacts", clientContactsRouter);
  api.route("/clients/:clientId/retainers", clientRetainersRouter);
  api.route("/clients/:clientId/interactions", clientInteractionsRouter);
  api.route("/clients/:clientId/documents", clientDocumentsRouter);
  api.route("/clients", clientsRoutes);

  api.route("/users", usersRoutes);
  api.route("/contacts", contactsRouter);
  api.route("/retainers", retainersRouter);
  api.route("/tasks", tasksRoutes);
  api.route("/interactions", interactionsRouter);
  api.route("/deals", dealsRoutes);
  api.route("/documents", documentsRouter);
  api.route("/dashboard", dashboardRoutes);
  api.route("/automation-rules", automationRulesRoutes);

  // Test-only, and only when explicitly switched on in .dev.vars.
  api.use("/qa/*", async (c, next) => {
    if (!areQaHooksEnabled(c.env)) return c.json({ error: "Route not found" }, 404);
    await next();
  });
  api.route("/qa", qaRoutes);

  app.route("/api", api);

  // Unmatched /api/* is a 404 from the API rather than the SPA's index.html —
  // `run_worker_first: ["/api/*"]` in wrangler.jsonc routes it here, so this is
  // the only place that can answer it.
  app.all("/api/*", (c) => c.json({ error: "Route not found" }, 404));

  app.onError((err, c) => toErrorResponse(err, c));

  /**
   * Last-resort SPA fallback.
   *
   * In a correct deployment nothing non-API reaches here: `run_worker_first:
   * ["/api/*"]` means the asset router answers every other path, and its
   * `not_found_handling: "single-page-application"` hands unknown paths to
   * index.html for React Router. But that leaves the Worker's behaviour
   * dependent on deploy-time configuration it cannot see, and when the Worker
   * *is* reached first, Hono's default 404 for `/` renders as a blank page —
   * indistinguishable, from the browser, from a broken build.
   *
   * Serving index.html ourselves makes the app boot regardless of how the asset
   * router is configured. `/api/*` is already answered above, so it never gets
   * here and API 404s stay JSON.
   */
  app.notFound(async (c) => {
    const assets = (c.env as { ASSETS?: Fetcher }).ASSETS;
    if (!assets) return c.json({ error: "Route not found" }, 404);

    const url = new URL(c.req.url);
    const asset = await assets.fetch(new Request(url.toString(), { headers: c.req.raw.headers }));
    if (asset.status !== 404) return asset;

    // A client-side route rather than a real file: hand back the shell.
    const shell = await assets.fetch(new Request(new URL("/index.html", url).toString()));
    return new Response(shell.body, {
      status: shell.ok ? 200 : 404,
      headers: shell.headers,
    });
  });

  return app;
}

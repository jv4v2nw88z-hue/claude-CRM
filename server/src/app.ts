import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/requireAuth";
import { runAutomationEngine } from "./jobs/automationEngine";

import authRoutes from "./routes/auth.routes";
import clientsRoutes from "./routes/clients.routes";
import { clientContactsRouter, contactsRouter } from "./routes/contacts.routes";
import { clientRetainersRouter, retainersRouter } from "./routes/retainers.routes";
import tasksRoutes from "./routes/tasks.routes";
import {
  clientInteractionsRouter,
  interactionsRouter,
} from "./routes/interactions.routes";
import dealsRoutes from "./routes/deals.routes";
import { clientDocumentsRouter, documentsRouter } from "./routes/documents.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import automationRulesRoutes from "./routes/automationRules.routes";
import usersRoutes from "./routes/users.routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true, // the session lives in an httpOnly cookie
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // Escape hatch for hosts that sleep the process: an external cron can hit this
  // with the shared secret instead of relying on the in-process node-cron.
  app.post("/api/internal/run-automation", (req, res, next) => {
    const secret = req.header("x-automation-secret");
    if (!env.AUTOMATION_SECRET || secret !== env.AUTOMATION_SECRET) {
      return res.status(401).json({ error: "Not authorised" });
    }
    runAutomationEngine()
      .then((result) => res.json(result))
      .catch(next);
  });

  app.use("/api/auth", authRoutes);

  // Everything below requires a session.
  app.use("/api", requireAuth);

  app.use("/api/users", usersRoutes);
  app.use("/api/clients/:clientId/contacts", clientContactsRouter);
  app.use("/api/clients/:clientId/retainers", clientRetainersRouter);
  app.use("/api/clients/:clientId/interactions", clientInteractionsRouter);
  app.use("/api/clients/:clientId/documents", clientDocumentsRouter);
  app.use("/api/clients", clientsRoutes);
  app.use("/api/contacts", contactsRouter);
  app.use("/api/retainers", retainersRouter);
  app.use("/api/tasks", tasksRoutes);
  app.use("/api/interactions", interactionsRouter);
  app.use("/api/deals", dealsRoutes);
  app.use("/api/documents", documentsRouter);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/automation-rules", automationRulesRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

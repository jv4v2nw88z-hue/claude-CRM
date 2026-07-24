import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/db";
import { startAutomationCron } from "./jobs/automationEngine";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`MiDigitalExpansion CRM API listening on http://localhost:${env.PORT}`);
  startAutomationCron();
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

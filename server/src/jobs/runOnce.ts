import { prisma } from "../config/db";
import { runAutomationEngine } from "./automationEngine";

/** `npm run automation:run` — fires the engine once, for testing or an external cron. */
runAutomationEngine()
  .then((result) => {
    for (const task of result.tasksCreated) {
      console.log(`  + ${task.title}`);
    }
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

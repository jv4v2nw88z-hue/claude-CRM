import { createApp } from "./app";
import { createPrisma } from "./config/db";
import { runAutomationEngine } from "./jobs/automationEngine";

const app = createApp();

export default {
  fetch: app.fetch,

  /**
   * The daily automation run.
   *
   * node-cron kept a timer alive inside a long-running process; a Worker has no
   * process to keep alive, so the schedule lives in Cloudflare's infrastructure
   * (`triggers.crons` in wrangler.jsonc) and arrives here as an event. The
   * engine itself is unchanged and still idempotent, so a retried or duplicated
   * firing creates nothing extra.
   */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const prisma = createPrisma(env.DB);
    ctx.waitUntil(
      runAutomationEngine(prisma, env).catch((err) =>
        console.error("Automation engine failed:", err)
      )
    );
  },
} satisfies ExportedHandler<Env>;

import { Hono } from "hono";
import { runAutomationEngine } from "../jobs/automationEngine";
import { requireRole } from "../middleware/requireRole";
import {
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
} from "../utils/validation";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

/*
 * Reading rules is open to both accounts — Cole needs to see why a task
 * appeared. *Changing* them is TECHNICAL-only: these rules drive every upsell
 * reminder, and disabling one is silent and consequential.
 *
 * The gate is per-route rather than a blanket `on(["POST", ...])` because
 * `POST /run` is also a POST on this router and is deliberately left open — see
 * the comment there. Any new mutating route added here must opt in explicitly.
 */
const technicalOnly = requireRole("TECHNICAL");

router.get("/", async (c) => {
  const rules = await c.get("prisma").automationRule.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { generatedTasks: true } } },
  });
  return c.json(rules);
});

router.post("/", technicalOnly, async (c) => {
  const parsed = createAutomationRuleSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const rule = await c.get("prisma").automationRule.create({ data: parsed.data });
  return c.json(rule, 201);
});

router.patch("/:id", technicalOnly, async (c) => {
  const parsed = updateAutomationRuleSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const rule = await c.get("prisma").automationRule.update({
    where: { id: c.req.param("id") },
    data: parsed.data,
  });
  return c.json(rule);
});

router.delete("/:id", technicalOnly, async (c) => {
  const prisma = c.get("prisma");
  const id = c.req.param("id");

  // Tasks keep pointing at the rule that made them, so detach before deleting.
  // Detaching first means a failure here leaves orphaned-but-intact tasks and
  // the rule still in place, which is recoverable; deleting first would fail on
  // the foreign key anyway.
  await prisma.task.updateMany({ where: { sourceRuleId: id }, data: { sourceRuleId: null } });
  await prisma.automationRule.delete({ where: { id } });

  return c.body(null, 204);
});

/**
 * Lets Cole or Brian fire the engine by hand instead of waiting for 6am.
 *
 * Deliberately *not* behind requireRole, despite being a POST. Running the
 * engine changes no configuration and is idempotent — it creates the same
 * reminder tasks the 6am cron would, and skips any rule that already has a live
 * task. The risk the role gate exists to address is a rule being switched off
 * unnoticed; running one early is the opposite of that, and Cole is the person
 * most likely to want it before a call.
 */
router.post("/run", async (c) => c.json(await runAutomationEngine(c.get("prisma"), c.env)));

export default router;

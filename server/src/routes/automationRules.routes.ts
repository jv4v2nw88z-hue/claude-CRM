import { Router } from "express";
import { prisma } from "../config/db";
import { asyncHandler } from "../middleware/errorHandler";
import { runAutomationEngine } from "../jobs/automationEngine";
import {
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
} from "../utils/validation";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rules = await prisma.automationRule.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      include: { _count: { select: { generatedTasks: true } } },
    });
    res.json(rules);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createAutomationRuleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const rule = await prisma.automationRule.create({ data: parsed.data });
    res.status(201).json(rule);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateAutomationRuleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const rule = await prisma.automationRule.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(rule);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    // Tasks keep pointing at the rule that made them, so detach before deleting.
    await prisma.$transaction([
      prisma.task.updateMany({
        where: { sourceRuleId: req.params.id },
        data: { sourceRuleId: null },
      }),
      prisma.automationRule.delete({ where: { id: req.params.id } }),
    ]);
    res.status(204).send();
  })
);

/** Lets Cole or Brian fire the engine by hand instead of waiting for 6am. */
router.post(
  "/run",
  asyncHandler(async (_req, res) => {
    res.json(await runAutomationEngine());
  })
);

export default router;

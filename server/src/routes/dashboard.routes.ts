import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { getDashboardSummary, getRevenueSummary } from "../services/dashboardService";

const router = Router();

router.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    res.json(await getDashboardSummary());
  })
);

router.get(
  "/revenue",
  asyncHandler(async (_req, res) => {
    res.json(await getRevenueSummary());
  })
);

export default router;

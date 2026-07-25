import { Hono } from "hono";
import { getDashboardSummary, getRevenueSummary } from "../services/dashboardService";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

router.get("/summary", async (c) => c.json(await getDashboardSummary(c.get("prisma"))));
router.get("/revenue", async (c) => c.json(await getRevenueSummary(c.get("prisma"))));

export default router;

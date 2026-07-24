import { Router } from "express";
import { prisma } from "../config/db";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

/** Populates the assignee and account-owner pickers. Two people, no pagination needed. */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  })
);

export default router;

import { Hono } from "hono";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

/** Populates the assignee and account-owner pickers. Two people, no pagination needed. */
router.get("/", async (c) => {
  const users = await c.get("prisma").user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return c.json(users);
});

export default router;

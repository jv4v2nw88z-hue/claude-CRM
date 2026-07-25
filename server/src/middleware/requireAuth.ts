import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { requireJwtSecret } from "../config/env";
import { readSession, SESSION_COOKIE } from "../lib/jwt";
import type { AppEnv, AuthedUser } from "../types";
import type { UserRole } from "../domain/enums";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Not authenticated" }, 401);

  const userId = await readSession(token, requireJwtSecret(c.env));
  if (!userId) return c.json({ error: "Invalid or expired session" }, 401);

  const user = await c.get("prisma").user.findUnique({ where: { id: userId } });
  if (!user) return c.json({ error: "Invalid session" }, 401);

  const authed: AuthedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
  };
  c.set("user", authed);
  await next();
});

/** The signed-in user on any route mounted behind `requireAuth`. */
export function currentUser(c: { get: (key: "user") => AuthedUser | null }): AuthedUser | null {
  return c.get("user");
}

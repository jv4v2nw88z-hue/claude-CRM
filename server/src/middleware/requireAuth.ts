import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { requireJwtSecret } from "../config/env";
import { readSession, SESSION_COOKIE } from "../lib/jwt";
import type { AppEnv, AuthedUser } from "../types";
import type { UserRole } from "../domain/enums";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Not authenticated" }, 401);

  const claims = await readSession(token, requireJwtSecret(c.env));
  if (!claims) return c.json({ error: "Invalid or expired session" }, 401);

  const user = await c.get("prisma").user.findUnique({ where: { id: claims.userId } });
  if (!user) return c.json({ error: "Invalid session" }, 401);

  // The signature only proves the token was minted by us, not that it is still
  // meant to work. A logout, a password change or an offboarding bumps the row's
  // version, and every token issued before that stops being honoured here.
  if (user.tokenVersion !== claims.tokenVersion) {
    return c.json({ error: "Session has been revoked. Please sign in again." }, 401);
  }

  const authed: AuthedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    mustChangePassword: user.mustChangePassword,
  };
  c.set("user", authed);
  await next();
});

/** The signed-in user on any route mounted behind `requireAuth`. */
export function currentUser(c: { get: (key: "user") => AuthedUser | null }): AuthedUser | null {
  return c.get("user");
}

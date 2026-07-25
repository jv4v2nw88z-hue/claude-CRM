import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { isProduction, requireJwtSecret } from "../config/env";
import { verifyPassword } from "../lib/password";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "../lib/jwt";
import { requireAuth } from "../middleware/requireAuth";
import { loginSchema } from "../utils/validation";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

router.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  const { email, password } = parsed.data;
  const user = await c
    .get("prisma")
    .user.findUnique({ where: { email: email.toLowerCase().trim() } });
  // Same response either way so the form can't be used to enumerate accounts.
  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);

  const token = await signSession(user.id, requireJwtSecret(c.env));

  // The Worker serves the React app and the API from one origin, so the session
  // cookie is first-party and SameSite=Lax is enough — no SameSite=None needed
  // (and none of the third-party-cookie fragility that came with it).
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(c.env),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return c.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

router.post("/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.body(null, 204);
});

router.get("/me", requireAuth, (c) => c.json({ user: c.get("user") }));

export default router;

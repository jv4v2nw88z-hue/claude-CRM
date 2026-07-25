import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { isProduction, requireJwtSecret } from "../config/env";
import { hashPassword, verifyPassword } from "../lib/password";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "../lib/jwt";
import { requireAuth, currentUser } from "../middleware/requireAuth";
import { changePasswordSchema, loginSchema } from "../utils/validation";
import { HttpError } from "../lib/http";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

/**
 * Brute-force lockout.
 *
 * Ten consecutive failures locks the account for fifteen minutes. The window is
 * "consecutive" rather than rolling-by-time because a successful login clears
 * the counter, which is the behaviour a real user experiences and the one an
 * attacker cannot reset without already knowing the password.
 *
 * The lock is checked *before* verifyPassword, which matters for more than
 * convenience: hashing deliberately burns ~25ms of Worker CPU, so an unbounded
 * login endpoint is a CPU-exhaustion lever as much as a guessing one. Rejecting
 * early costs a single indexed read.
 */
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 15;

function sessionCookieOptions(env: Env) {
  return {
    httpOnly: true,
    secure: isProduction(env),
    sameSite: "Lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

router.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  const prisma = c.get("prisma");
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  // Same response either way so the form can't be used to enumerate accounts.
  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    // Naming the lock is not an enumeration leak worth worrying about — you have
    // to already be hammering a real account to see it — and without it a locked
    // user has no idea why a correct password stops working.
    return c.json(
      { error: `Too many failed attempts. Try again after ${LOCKOUT_MINUTES} minutes.` },
      429
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    const reachedLimit = failedLoginCount >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: reachedLimit
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : user.lockedUntil,
      },
    });
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Clear the counter only when it is actually dirty, so the common path stays a
  // single read rather than a read plus a write on every sign-in.
  if (user.failedLoginCount !== 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  const token = await signSession(user.id, user.tokenVersion, requireJwtSecret(c.env));

  // The Worker serves the React app and the API from one origin, so the session
  // cookie is first-party and SameSite=Lax is enough — no SameSite=None needed
  // (and none of the third-party-cookie fragility that came with it).
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(c.env));

  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

/**
 * Logout revokes rather than just forgetting.
 *
 * Clearing the cookie only affects the browser that asked. Bumping the version
 * invalidates every token this user holds — which is the difference between
 * "signed out on this laptop" and "that stolen token no longer works".
 *
 * Runs behind requireAuth so there is a user to bump; an unauthenticated logout
 * has nothing to revoke and 401s, which is correct.
 */
router.post("/logout", requireAuth, async (c) => {
  const user = currentUser(c);
  if (user) {
    await c.get("prisma").user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.body(null, 204);
});

/**
 * Change password.
 *
 * Bumps tokenVersion, so changing a password signs out every other session —
 * the behaviour you want if the reason you are changing it is that you think
 * someone else has it. The current session is re-issued at the new version so
 * the person doing the change isn't logged out of the tab they're in.
 */
router.post("/change-password", requireAuth, async (c) => {
  const authed = currentUser(c);
  if (!authed) throw new HttpError(401, "Not authenticated");

  const parsed = changePasswordSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const prisma = c.get("prisma");
  const user = await prisma.user.findUnique({ where: { id: authed.id } });
  if (!user) throw new HttpError(401, "Not authenticated");

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return c.json({ error: "Current password is incorrect" }, 400);

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return c.json({ error: "The new password must be different from the current one" }, 400);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  // Re-issue at the new version, or the caller invalidates their own session.
  const token = await signSession(updated.id, updated.tokenVersion, requireJwtSecret(c.env));
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(c.env));

  return c.json({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      mustChangePassword: updated.mustChangePassword,
    },
  });
});

router.get("/me", requireAuth, (c) => c.json({ user: c.get("user") }));

export default router;

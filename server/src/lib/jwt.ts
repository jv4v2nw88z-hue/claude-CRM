import { sign, verify } from "hono/jwt";

/**
 * Session tokens.
 *
 * `jsonwebtoken` depends on Node's crypto module; hono/jwt does the same HS256
 * signing on WebCrypto, which is what the Workers runtime actually provides.
 *
 * The token carries a `tokenVersion` alongside the user id. A JWT is stateless
 * and cannot be withdrawn once issued, so without this, clearing the cookie on
 * logout only affects the browser that asked — a token copied off a shared
 * machine stayed valid for its whole lifetime. `requireAuth` compares the
 * embedded version against the row, so bumping the column invalidates every
 * token that user holds, everywhere, immediately.
 */

export const SESSION_COOKIE = "session_token";

/**
 * Seven days, down from thirty. The version check makes revocation possible, but
 * TTL is still the backstop for a token nobody knows to revoke — and thirty days
 * is a long time to be wrong about that.
 */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

interface SessionPayload {
  userId: string;
  tokenVersion: number;
  exp: number;
  [key: string]: unknown;
}

/** What a verified token asserts. Both fields must match the row to be honoured. */
export interface SessionClaims {
  userId: string;
  tokenVersion: number;
}

export async function signSession(
  userId: string,
  tokenVersion: number,
  secret: string
): Promise<string> {
  const payload: SessionPayload = {
    userId,
    tokenVersion,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  return sign(payload, secret, "HS256");
}

/** Returns null for a missing, tampered-with or expired token — never throws. */
export async function readSession(token: string, secret: string): Promise<SessionClaims | null> {
  try {
    const payload = (await verify(token, secret, "HS256")) as SessionPayload;
    if (typeof payload.userId !== "string") return null;

    // Tokens minted before this field existed have no version. Treating a missing
    // version as 0 would silently honour them; rejecting is the safer default
    // and costs one re-login.
    if (typeof payload.tokenVersion !== "number") return null;

    return { userId: payload.userId, tokenVersion: payload.tokenVersion };
  } catch {
    return null;
  }
}

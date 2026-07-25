import { sign, verify } from "hono/jwt";

/**
 * Session tokens.
 *
 * `jsonwebtoken` depends on Node's crypto module; hono/jwt does the same HS256
 * signing on WebCrypto, which is what the Workers runtime actually provides.
 */

export const SESSION_COOKIE = "session_token";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

interface SessionPayload {
  userId: string;
  exp: number;
  [key: string]: unknown;
}

export async function signSession(userId: string, secret: string): Promise<string> {
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  return sign(payload, secret, "HS256");
}

/** Returns null for a missing, tampered-with or expired token — never throws. */
export async function readSession(token: string, secret: string): Promise<string | null> {
  try {
    const payload = (await verify(token, secret, "HS256")) as SessionPayload;
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

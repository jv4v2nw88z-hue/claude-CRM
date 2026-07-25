import type { Context } from "hono";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * The server is missing a setting it cannot run without.
 *
 * Distinct from HttpError because it is not the caller's fault and the message
 * is deliberately shown: a missing JWT_SECRET surfaced as a bare "Internal
 * server error" on the login form, which tells whoever is trying to sign in
 * nothing at all and looks identical to a real bug. Naming the missing variable
 * leaks nothing — its *value* is the secret — and it is the difference between a
 * one-minute dashboard fix and an afternoon of guessing.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/**
 * Prisma's known-request errors are matched by their `P####` code rather than
 * `instanceof`. The generated client is bundled into the Worker, so an identity
 * check against a separately-imported class is fragile; the code is stable.
 */
function prismaErrorCode(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === "string" && /^P\d{4}$/.test(code)) return code;
  }
  return null;
}

/**
 * Reads a path parameter that the mount point guarantees exists.
 *
 * Sub-routers are mounted under paths like /clients/:clientId/contacts, but a
 * router declared on its own has no way to prove that to the type checker —
 * `c.req.param` is `string | undefined` inside it. This turns the impossible
 * case into an explicit 400 instead of a non-null assertion.
 */
export function requireParam(c: Context, name: string): string {
  const value = c.req.param(name);
  if (!value) throw new HttpError(400, `Missing ${name} in the request path`);
  return value;
}

export function toErrorResponse(err: unknown, c: Context): Response {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as 400);
  }

  // 503, not 500: the request was fine, the deployment is incomplete.
  if (err instanceof ConfigurationError) {
    console.error("Configuration error:", err.message);
    return c.json({ error: err.message }, 503);
  }

  if (err instanceof ZodError) {
    return c.json({ error: "Validation failed", details: err.flatten() }, 400);
  }

  switch (prismaErrorCode(err)) {
    case "P2025":
      return c.json({ error: "Record not found" }, 404);
    case "P2002":
      return c.json({ error: "That record already exists" }, 409);
    case "P2003":
      return c.json({ error: "Related record does not exist" }, 400);
  }

  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
}

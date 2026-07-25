/**
 * Environment access for the Worker.
 *
 * There is no `process.env` here and no dotenv: plaintext settings come from
 * `vars` in wrangler.jsonc, secrets from `wrangler secret put`, and both arrive
 * together on the request as `c.env`. Everything except JWT_SECRET is optional
 * and degrades gracefully, exactly as the Node version did.
 */

import { ConfigurationError } from "../lib/http";

export const JWT_SECRET_MIN_LENGTH = 16;

/** Throws at the edge of the request rather than booting a half-configured app. */
export function requireJwtSecret(env: Env): string {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < JWT_SECRET_MIN_LENGTH) {
    throw new ConfigurationError(
      `This deployment has no JWT_SECRET set, so sessions can't be signed and ` +
        `nobody can sign in. Add it as a secret on the Worker (Settings → ` +
        `Variables and Secrets, or \`npx wrangler secret put JWT_SECRET\`) using ` +
        `${JWT_SECRET_MIN_LENGTH}+ random characters.`
    );
  }
  return secret;
}

export function isProduction(env: Env): boolean {
  return (env.APP_ENV ?? "production") === "production";
}

export function isEmailEnabled(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/**
 * The documents bucket, when one is bound.
 *
 * Read through an optional view of `Env` rather than off it directly: the R2
 * binding is genuinely optional (uploads are a feature you can decline, and R2
 * has to be enabled on the account before a bucket can exist), so commenting
 * out `r2_buckets` in wrangler.jsonc drops `DOCUMENTS` from the type `wrangler
 * types` generates. This keeps both configurations compiling.
 */
export function documentsBucket(env: Env): R2Bucket | undefined {
  return (env as { DOCUMENTS?: R2Bucket }).DOCUMENTS;
}

/** R2 is a binding, so "configured" simply means the bucket was bound. */
export function isStorageEnabled(env: Env): boolean {
  return Boolean(documentsBucket(env));
}

/**
 * QA-only hooks (used by scripts/lifecycleCheck.ts to backdate automation
 * anchors) mount only when this is explicitly turned on. It is never set in
 * production — see .dev.vars.example.
 */
export function areQaHooksEnabled(env: Env): boolean {
  // Two independent conditions, because one env var is one typo away from
  // exposing hard-delete and tier-history rewriting on the live database. A
  // production deployment cannot enable these no matter what QA_HOOKS_ENABLED
  // says — turning them on there requires changing APP_ENV too, which is a
  // deliberate act rather than a slip.
  return env.QA_HOOKS_ENABLED === "true" && !isProduction(env);
}

export function corsOrigins(env: Env): string[] {
  return (env.CORS_ORIGIN ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function mailFrom(env: Env): string {
  return env.MAIL_FROM || "MiDigitalExpansion CRM <crm@midigitalexpansion.com>";
}

/**
 * The R2 bucket's public origin, when it has one.
 *
 * Widened to `string` deliberately: `wrangler types` turns the empty default in
 * wrangler.jsonc into the literal type `""`, which narrows to `never` the moment
 * a caller checks it for emptiness.
 */
export function r2PublicBaseUrl(env: Env): string {
  return (env.R2_PUBLIC_BASE_URL as string) ?? "";
}

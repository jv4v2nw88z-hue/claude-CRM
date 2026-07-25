import { isStorageEnabled, r2PublicBaseUrl } from "../config/env";
import { HttpError } from "../lib/http";

/**
 * Document storage on R2.
 *
 * The S3 version handed the browser a presigned PUT so the API never touched
 * the bytes. Presigning needs S3 API credentials; a bound R2 bucket is reached
 * by capability instead, with no keys to sign with — so uploads now stream
 * through the Worker in one request, which is simpler and removes both AWS SDK
 * packages and the two-step confirm dance from the client.
 */

function bucket(env: Env): R2Bucket {
  if (!isStorageEnabled(env)) {
    throw new HttpError(
      503,
      "File storage is not configured. Bind an R2 bucket as DOCUMENTS in wrangler.jsonc to enable uploads."
    );
  }
  return env.DOCUMENTS;
}

export function buildKey(clientId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return `clients/${clientId}/${crypto.randomUUID()}-${safeName}`;
}

export async function putObject(
  env: Env,
  key: string,
  body: ArrayBuffer,
  contentType: string
): Promise<void> {
  await bucket(env).put(key, body, {
    httpMetadata: { contentType: contentType || "application/octet-stream" },
  });
}

export async function getObject(env: Env, key: string): Promise<R2ObjectBody | null> {
  const object = await bucket(env).get(key);
  return object ?? null;
}

export async function deleteObject(env: Env, key: string): Promise<void> {
  await bucket(env).delete(key);
}

/**
 * A direct URL only exists when the bucket is exposed on a custom domain.
 * Otherwise documents are served back through the Worker, which keeps them
 * behind the same session cookie as everything else.
 */
export function publicUrlFor(env: Env, key: string): string | null {
  const base = r2PublicBaseUrl(env);
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${key}`;
}

export { isStorageEnabled };

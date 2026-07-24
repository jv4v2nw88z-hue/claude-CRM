import { randomUUID } from "crypto";
import { env, isStorageEnabled } from "../config/env";
import { HttpError } from "../middleware/errorHandler";

type S3ClientLike = { send: (cmd: unknown) => Promise<unknown> };

let client: S3ClientLike | null = null;

function getClient(): S3ClientLike {
  if (!isStorageEnabled) {
    throw new HttpError(
      503,
      "File storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY to enable uploads."
    );
  }
  if (!client) {
    const { S3Client } = require("@aws-sdk/client-s3");
    client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT, // Cloudflare R2 endpoint, omitted for plain S3
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY as string,
        secretAccessKey: env.S3_SECRET_KEY as string,
      },
    }) as S3ClientLike;
  }
  return client;
}

function buildKey(clientId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return `clients/${clientId}/${randomUUID()}-${safeName}`;
}

export interface PresignedUpload {
  uploadUrl: string;
  storageKey: string;
  fileUrl: string;
}

/** Returns a short-lived PUT URL so the browser uploads straight to R2/S3. */
export async function createUploadUrl(
  clientId: string,
  fileName: string,
  contentType: string
): Promise<PresignedUpload> {
  const s3 = getClient();
  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

  const storageKey = buildKey(clientId, fileName);
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: storageKey,
    ContentType: contentType,
  });

  const uploadUrl: string = await getSignedUrl(s3, command, { expiresIn: 900 });
  const fileUrl = env.S3_PUBLIC_BASE_URL
    ? `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${storageKey}`
    : storageKey;

  return { uploadUrl, storageKey, fileUrl };
}

/** Signed GET URL, needed when the bucket isn't public. */
export async function createDownloadUrl(storageKey: string): Promise<string> {
  const s3 = getClient();
  const { GetObjectCommand } = require("@aws-sdk/client-s3");
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey });
  return getSignedUrl(s3, command, { expiresIn: 900 });
}

export async function deleteObject(storageKey: string): Promise<void> {
  const s3 = getClient();
  const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey }));
}

export { isStorageEnabled };

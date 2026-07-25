import { Hono } from "hono";
import { HttpError, requireParam } from "../lib/http";
import {
  buildKey,
  deleteObject,
  getObject,
  isStorageEnabled,
  publicUrlFor,
  putObject,
} from "../services/storageService";
import { uploadDocumentSchema } from "../utils/validation";
import type { AppEnv } from "../types";

/** Mounted at /api/clients/:clientId/documents */
export const clientDocumentsRouter = new Hono<AppEnv>();

clientDocumentsRouter.get("/", async (c) => {
  const documents = await c.get("prisma").document.findMany({
    where: { clientId: requireParam(c, "clientId") },
    orderBy: { uploadedAt: "desc" },
  });
  return c.json(documents);
});

/**
 * One-step upload.
 *
 * The S3 build handed the browser a presigned PUT and then took a second call to
 * confirm the metadata. A bound R2 bucket has no credentials to presign with, so
 * the bytes come through the Worker instead — which also means a failed R2 write
 * can no longer leave a database row pointing at an object that was never stored.
 */
clientDocumentsRouter.post("/", async (c) => {
  if (!isStorageEnabled(c.env)) {
    throw new HttpError(
      503,
      "File storage is not configured. Bind an R2 bucket as DOCUMENTS in wrangler.jsonc to enable uploads."
    );
  }

  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "Expected a multipart form with a 'file' field" }, 400);
  }

  const parsed = uploadDocumentSchema.safeParse({ category: form.get("category") ?? null });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const clientId = requireParam(c, "clientId");
  const storageKey = buildKey(clientId, file.name);

  await putObject(c.env, storageKey, await file.arrayBuffer(), file.type);

  const document = await c.get("prisma").document.create({
    data: {
      clientId,
      fileName: file.name,
      storageKey,
      fileUrl: publicUrlFor(c.env, storageKey) ?? storageKey,
      category: parsed.data.category,
    },
  });

  return c.json(document, 201);
});

/** Mounted at /api/documents */
export const documentsRouter = new Hono<AppEnv>();

documentsRouter.get("/config", (c) => c.json({ storageEnabled: isStorageEnabled(c.env) }));

/**
 * Where to fetch a document from. A bucket on a public custom domain is linked
 * directly; otherwise the download goes back through the Worker, which keeps it
 * behind the same session cookie as the rest of the app.
 */
documentsRouter.get("/:id/download-url", async (c) => {
  const id = c.req.param("id");
  const document = await c.get("prisma").document.findUniqueOrThrow({ where: { id } });

  if (!document.storageKey) return c.json({ url: document.fileUrl });

  const publicUrl = publicUrlFor(c.env, document.storageKey);
  return c.json({ url: publicUrl ?? `/api/documents/${id}/content` });
});

documentsRouter.get("/:id/content", async (c) => {
  const document = await c
    .get("prisma")
    .document.findUniqueOrThrow({ where: { id: c.req.param("id") } });
  if (!document.storageKey) throw new HttpError(404, "This document has no stored file");

  const object = await getObject(c.env, document.storageKey);
  if (!object) throw new HttpError(404, "File not found in storage");

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${document.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});

documentsRouter.delete("/:id", async (c) => {
  const prisma = c.get("prisma");
  const id = c.req.param("id");
  const document = await prisma.document.findUniqueOrThrow({ where: { id } });

  if (document.storageKey && isStorageEnabled(c.env)) {
    // Losing the object is not a reason to keep a dead row in the list.
    await deleteObject(c.env, document.storageKey).catch((err) =>
      console.error("Failed to delete object from storage:", err)
    );
  }
  await prisma.document.delete({ where: { id } });
  return c.body(null, 204);
});

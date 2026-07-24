import { Router } from "express";
import { prisma } from "../config/db";
import { asyncHandler } from "../middleware/errorHandler";
import {
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  isStorageEnabled,
} from "../services/storageService";
import { confirmDocumentSchema, requestUploadSchema } from "../utils/validation";

/** Mounted at /api/clients/:clientId/documents */
export const clientDocumentsRouter = Router({ mergeParams: true });

clientDocumentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const documents = await prisma.document.findMany({
      where: { clientId: req.params.clientId },
      orderBy: { uploadedAt: "desc" },
    });
    res.json(documents);
  })
);

/** Step 1 of the upload: hand the browser a signed PUT URL. */
clientDocumentsRouter.post(
  "/upload-url",
  asyncHandler(async (req, res) => {
    const parsed = requestUploadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const upload = await createUploadUrl(
      req.params.clientId,
      parsed.data.fileName,
      parsed.data.contentType
    );
    res.json(upload);
  })
);

/** Step 2: record the metadata once the browser's PUT succeeded. */
clientDocumentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = confirmDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const document = await prisma.document.create({
      data: { ...parsed.data, clientId: req.params.clientId },
    });
    res.status(201).json(document);
  })
);

/** Mounted at /api/documents */
export const documentsRouter = Router();

documentsRouter.get(
  "/:id/download-url",
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUniqueOrThrow({ where: { id: req.params.id } });
    if (!document.storageKey) return res.json({ url: document.fileUrl });
    res.json({ url: await createDownloadUrl(document.storageKey) });
  })
);

documentsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUniqueOrThrow({ where: { id: req.params.id } });
    if (document.storageKey && isStorageEnabled) {
      // Losing the object is not a reason to keep a dead row in the list.
      await deleteObject(document.storageKey).catch((err) =>
        console.error("Failed to delete object from storage:", err)
      );
    }
    await prisma.document.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

documentsRouter.get("/config", (_req, res) => {
  res.json({ storageEnabled: isStorageEnabled });
});

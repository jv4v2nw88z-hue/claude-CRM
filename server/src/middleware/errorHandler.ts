import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps async route handlers so rejected promises reach the error handler. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", details: err.flatten() });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return res.status(404).json({ error: "Record not found" });
    if (err.code === "P2002") return res.status(409).json({ error: "That record already exists" });
    if (err.code === "P2003") return res.status(400).json({ error: "Related record does not exist" });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db";
import { env } from "../config/env";

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  role: "SALES" | "TECHNICAL";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.session_token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: "Invalid session" });

    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/requireAuth";
import { loginSchema } from "../utils/validation";

const router = Router();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Email and password are required" });

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    // Same response either way so the form can't be used to enumerate accounts.
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: "30d" });
    res.cookie("session_token", token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: THIRTY_DAYS_MS,
    });

    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  })
);

router.post("/logout", (_req, res) => {
  res.clearCookie("session_token");
  res.status(204).send();
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;

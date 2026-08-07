
import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { validateBody } from "../middleware/validate";
import { HttpError, asyncHandler } from "../lib/httpError";
import { signToken, verifyPassword, requireAuth, type AuthedRequest } from "../lib/auth";
import { logAudit } from "../lib/audit";

export const authRouter = Router();

const Login = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", validateBody(Login), asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username.toLowerCase()));
  if (!user || !user.active) throw new HttpError(401, "UNAUTHORIZED", "Invalid credentials or inactive account");
  if (!verifyPassword(password, user.passwordHash)) throw new HttpError(401, "UNAUTHORIZED", "Invalid credentials");
  const authUser = { id: user.id, role: user.role, name: user.name, username: user.username };

  // Critical audit: record every login with actor name, ID, and timestamp
  await logAudit(
    user.id,
    "login",
    "auth",
    `"${user.name}" (ID: ${user.id}, role: ${user.role}) signed in`,
  );

  res.json({ token: signToken(authUser), user: authUser });
}));

authRouter.get("/me", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  res.json({ user: req.user });
}));

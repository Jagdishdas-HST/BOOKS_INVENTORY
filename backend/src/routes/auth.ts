
import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { validateBody } from "../middleware/validate";
import { HttpError, asyncHandler } from "../lib/httpError";
import { signToken, verifyPassword, requireAuth, type AuthedRequest } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { healDemoUser } from "../lib/seed";

export const authRouter = Router();

const Login = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", validateBody(Login), asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const uname = String(username).trim().toLowerCase();

  let [user] = await db.select().from(schema.users).where(eq(schema.users.username, uname));

  // SELF-HEAL: if this is a known demo account that is missing, inactive, or
  // whose password no longer matches, repair it right here and re-fetch. This
  // guarantees the advertised demo credentials always authenticate, even if
  // the boot-time seed hadn't finished or a previous state was inconsistent.
  const passwordOk = user ? verifyPassword(password, user.passwordHash) : false;
  if (!user || !user.active || !passwordOk) {
    const healed = await healDemoUser(uname);
    if (healed) {
      user = healed;
    }
  }

  if (!user || !user.active) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid credentials or inactive account");
  }
  if (!verifyPassword(password, user.passwordHash)) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid credentials");
  }

  const authUser = { id: user.id, role: user.role, name: user.name, username: user.username };

  // Critical audit: record every login with actor name, ID, and timestamp.
  try {
    await logAudit(
      user.id,
      "login",
      "auth",
      `"${user.name}" (ID: ${user.id}, role: ${user.role}) signed in`,
    );
  } catch (e) {
    // Never let an audit-log failure block a valid login.
    console.error("[joylo-backend] audit log failed on login:", e);
  }

  res.json({ token: signToken(authUser), user: authUser });
}));

authRouter.get("/me", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  res.json({ user: req.user });
}));

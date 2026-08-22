
import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { validateBody } from "../middleware/validate";
import { HttpError, asyncHandler } from "../lib/httpError";
import { signToken, verifyPassword, requireAuth, type AuthedRequest } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { DEMO_USERS, healDemoUser } from "../lib/seed";

export const authRouter = Router();

const Login = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", validateBody(Login), asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const uname = String(username).trim().toLowerCase();

  // Is this a known demo account? If so we can always repair it to match the
  // advertised credentials.
  const demo = DEMO_USERS.find((d) => d.username.toLowerCase() === uname);

  let [user] = await db.select().from(schema.users).where(eq(schema.users.username, uname));

  // Determine whether the current DB row already authenticates.
  let passwordOk = user ? verifyPassword(password, user.passwordHash) : false;

  // SELF-HEAL: for a known demo account, if the row is missing, inactive, or
  // its password does not match, (re)create it with the correct hash and
  // re-verify. This is what guarantees every advertised demo credential
  // authenticates every single time, regardless of prior DB state or an
  // unfinished boot-time seed.
  if (demo && (!user || !user.active || !passwordOk)) {
    const healed = await healDemoUser(uname);
    if (healed) {
      user = healed;
      passwordOk = verifyPassword(password, user.passwordHash);
    }
  }

  if (!user || !user.active) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid credentials or inactive account");
  }
  if (!passwordOk) {
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

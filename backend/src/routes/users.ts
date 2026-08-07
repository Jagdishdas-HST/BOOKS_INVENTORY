
import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { validateBody } from "../middleware/validate";
import { HttpError, asyncHandler } from "../lib/httpError";
import { requireAuth, requireRole, hashPassword, type AuthedRequest } from "../lib/auth";
import { logAudit } from "../lib/audit";

export const usersRouter = Router();

usersRouter.get("/", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (_req, res) => {
  const rows = await db.select({
    id: schema.users.id, name: schema.users.name, username: schema.users.username,
    role: schema.users.role, active: schema.users.active, createdAt: schema.users.createdAt,
  }).from(schema.users).orderBy(schema.users.createdAt);
  res.json(rows);
}));

usersRouter.get("/distributors", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (_req, res) => {
  const rows = await db.select({ id: schema.users.id, name: schema.users.name, username: schema.users.username, active: schema.users.active })
    .from(schema.users).where(eq(schema.users.role, "distributor")).orderBy(schema.users.name);
  res.json(rows);
}));

const CreateUser = z.object({
  name: z.string().min(1),
  username: z.string().min(2),
  password: z.string().min(4),
  role: z.enum(["super_admin", "inventory_manager", "distributor"]),
});

usersRouter.post("/", requireAuth, requireRole("super_admin"), validateBody(CreateUser), asyncHandler(async (req: AuthedRequest, res) => {
  const { name, username, password, role } = req.body;
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.username, username.toLowerCase()));
  if (existing) throw new HttpError(400, "DUPLICATE", "Username already exists");
  const [row] = await db.insert(schema.users).values({
    name, username: username.toLowerCase(), passwordHash: hashPassword(password), role,
  }).returning();
  // Critical audit: new user record — actor, new user name, ID, role, date
  await logAudit(
    req.user!.id,
    "create",
    "user",
    `"${req.user!.name}" (ID: ${req.user!.id}) created ${role} "${name}" (new ID: ${row.id}, username: ${row.username})`,
  );
  res.status(201).json({ id: row.id, name: row.name, username: row.username, role: row.role, active: row.active });
}));

usersRouter.patch("/:id/active", requireAuth, requireRole("super_admin"), asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const active = Boolean(req.body?.active);
  const [row] = await db.update(schema.users).set({ active }).where(eq(schema.users.id, id)).returning();
  if (!row) throw new HttpError(404, "NOT_FOUND", "User not found");
  // Critical audit: activation/deactivation — actor, target user, ID, date
  await logAudit(
    req.user!.id,
    active ? "activate" : "deactivate",
    "user",
    `"${req.user!.name}" (ID: ${req.user!.id}) ${active ? "activated" : "deactivated"} user "${row.name}" (ID: ${row.id})`,
  );
  res.json({ id: row.id, active: row.active });
}));

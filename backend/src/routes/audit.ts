
import { Router } from "express";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, schema } from "../db/client";
import { asyncHandler } from "../lib/httpError";
import { requireAuth, requireRole } from "../lib/auth";

export const auditRouter = Router();

// Super Admin only. Filterable by action, entity, userId, and date range.
auditRouter.get("/", requireAuth, requireRole("super_admin"), asyncHandler(async (req, res) => {
  const conditions: any[] = [];

  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const entity = typeof req.query.entity === "string" ? req.query.entity : undefined;
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  if (action && action !== "all") conditions.push(eq(schema.auditLog.action, action));
  if (entity && entity !== "all") conditions.push(eq(schema.auditLog.entity, entity));
  if (userId && !Number.isNaN(userId)) conditions.push(eq(schema.auditLog.userId, userId));
  if (from) conditions.push(gte(schema.auditLog.createdAt, new Date(from)));
  if (to) conditions.push(lte(schema.auditLog.createdAt, new Date(to)));

  const rows = await db.select({
    id: schema.auditLog.id,
    action: schema.auditLog.action,
    entity: schema.auditLog.entity,
    details: schema.auditLog.details,
    createdAt: schema.auditLog.createdAt,
    userName: schema.users.name,
    userRole: schema.users.role,
  }).from(schema.auditLog)
    .innerJoin(schema.users, eq(schema.auditLog.userId, schema.users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(300);

  res.json(rows);
}));

// Distinct action & entity values for filter chips.
auditRouter.get("/facets", requireAuth, requireRole("super_admin"), asyncHandler(async (_req, res) => {
  const actions = await db.selectDistinct({ action: schema.auditLog.action }).from(schema.auditLog);
  const entities = await db.selectDistinct({ entity: schema.auditLog.entity }).from(schema.auditLog);
  res.json({
    actions: actions.map((a) => a.action).sort(),
    entities: entities.map((e) => e.entity).sort(),
  });
}));

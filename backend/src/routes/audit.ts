
import { Router } from "express";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db, schema } from "../db/client";
import { asyncHandler } from "../lib/httpError";
import { requireAuth, requireRole } from "../lib/auth";

export const auditRouter = Router();

// Full audit log — Super Admin only. Filterable by ?action, ?entity, ?userId,
// ?from, ?to. Returns most recent 500 entries with the acting user's name+role.
auditRouter.get(
  "/",
  requireAuth,
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const conds: SQL[] = [];

    if (typeof req.query.action === "string" && req.query.action !== "all") {
      conds.push(eq(schema.auditLog.action, req.query.action));
    }
    if (typeof req.query.entity === "string" && req.query.entity !== "all") {
      conds.push(eq(schema.auditLog.entity, req.query.entity));
    }
    if (req.query.userId && !Number.isNaN(Number(req.query.userId))) {
      conds.push(eq(schema.auditLog.userId, Number(req.query.userId)));
    }
    if (typeof req.query.from === "string" && req.query.from) {
      const fromDate = new Date(req.query.from + "T00:00:00");
      if (!isNaN(fromDate.getTime())) conds.push(gte(schema.auditLog.createdAt, fromDate));
    }
    if (typeof req.query.to === "string" && req.query.to) {
      const toDate = new Date(req.query.to + "T23:59:59");
      if (!isNaN(toDate.getTime())) conds.push(lte(schema.auditLog.createdAt, toDate));
    }

    const rows = await db
      .select({
        id: schema.auditLog.id,
        action: schema.auditLog.action,
        entity: schema.auditLog.entity,
        details: schema.auditLog.details,
        createdAt: schema.auditLog.createdAt,
        userId: schema.auditLog.userId,
        userName: schema.users.name,
        userRole: schema.users.role,
      })
      .from(schema.auditLog)
      .innerJoin(schema.users, eq(schema.auditLog.userId, schema.users.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(500);

    res.json(rows);
  }),
);

// Distinct action types — powers the audit filter chips.
auditRouter.get(
  "/actions",
  requireAuth,
  requireRole("super_admin"),
  asyncHandler(async (_req, res) => {
    const rows = await db.selectDistinct({ action: schema.auditLog.action }).from(schema.auditLog);
    res.json(rows.map((r) => r.action).sort());
  }),
);

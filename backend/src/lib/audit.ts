
import { db, schema } from "../db/client";

/**
 * Append an immutable audit record.
 *
 * Every critical action (create, update, delete, stock movement, sale, login,
 * price change, remittance) MUST call this. The record captures:
 *   - userId   — who performed the action (name + ID resolved at query time)
 *   - action   — verb: "create" | "update" | "delete" | "assign" | "return" |
 *                "transfer" | "stock_in" | "adjust" | "sale" | "sale_conflict" |
 *                "remittance" | "remittance_allocated" | "price_change" |
 *                "activate" | "deactivate" | "login"
 *   - entity   — noun: "book" | "user" | "stock" | "sale" | "remittance" | "auth"
 *   - details  — human-readable sentence including record name, ID, and quantity
 *                delta where applicable. Format: `<qty>x "<title>" (ID: <id>) ...`
 *   - createdAt — defaults to now(); pass explicitly only for historical seed data
 */
export async function logAudit(
  userId: number,
  action: string,
  entity: string,
  details?: string,
  createdAt?: Date,
) {
  await db.insert(schema.auditLog).values({
    userId,
    action,
    entity,
    details: details ?? null,
    createdAt: createdAt ?? new Date(),
  });
}
</ANTML-write>

<JOYLO-write file_path="backend/src/routes/audit.ts">
import { Router } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "../db/client";
import { HttpError, asyncHandler } from "../lib/httpError";
import { requireAuth, requireRole } from "../lib/auth";

export const auditRouter = Router();

// Super Admin only. Filterable by action, entity, userId, and date range.
// Returns enriched rows: actor name, role, action, entity, details, timestamp.
auditRouter.get("/", requireAuth, requireRole("super_admin"), asyncHandler(async (req, res) => {
  const conditions: any[] = [];

  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const entity = typeof req.query.entity === "string" ? req.query.entity : undefined;
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const limit = Math.min(Number(req.query.limit) || 500, 1000);

  if (action && action !== "all") conditions.push(eq(schema.auditLog.action, action));
  if (entity && entity !== "all") conditions.push(eq(schema.auditLog.entity, entity));
  if (userId && !Number.isNaN(userId)) conditions.push(eq(schema.auditLog.userId, userId));
  if (from) conditions.push(gte(schema.auditLog.createdAt, new Date(from)));
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(schema.auditLog.createdAt, toDate));
  }

  const rows = await db.select({
    id: schema.auditLog.id,
    action: schema.auditLog.action,
    entity: schema.auditLog.entity,
    details: schema.auditLog.details,
    createdAt: schema.auditLog.createdAt,
    userId: schema.auditLog.userId,
    userName: schema.users.name,
    userRole: schema.users.role,
    userUsername: schema.users.username,
  }).from(schema.auditLog)
    .innerJoin(schema.users, eq(schema.auditLog.userId, schema.users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit);

  res.json(rows);
}));

// Distinct action & entity values for filter chips.
auditRouter.get("/facets", requireAuth, requireRole("super_admin"), asyncHandler(async (_req, res) => {
  const actions = await db.selectDistinct({ action: schema.auditLog.action }).from(schema.auditLog);
  const entities = await db.selectDistinct({ entity: schema.auditLog.entity }).from(schema.auditLog);
  const users = await db.select({
    id: schema.users.id,
    name: schema.users.name,
    role: schema.users.role,
  }).from(schema.users).orderBy(schema.users.name);

  res.json({
    actions: actions.map((a) => a.action).sort(),
    entities: entities.map((e) => e.entity).sort(),
    users,
  });
}));

// Append-only enforcement — audit trail is immutable via the API.
const rejectMutation = asyncHandler(async () => {
  throw new HttpError(403, "APPEND_ONLY", "The audit log is append-only and cannot be edited or deleted");
});
auditRouter.patch("/:id", requireAuth, requireRole("super_admin"), rejectMutation);
auditRouter.put("/:id", requireAuth, requireRole("super_admin"), rejectMutation);
auditRouter.delete("/:id", requireAuth, requireRole("super_admin"), rejectMutation);
auditRouter.delete("/", requireAuth, requireRole("super_admin"), rejectMutation);

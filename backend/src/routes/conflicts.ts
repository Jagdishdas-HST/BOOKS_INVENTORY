
import { Router } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "../db/client";
import { validateBody } from "../middleware/validate";
import { HttpError, asyncHandler } from "../lib/httpError";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth";
import { logAudit } from "../lib/audit";

export const conflictsRouter = Router();

// Distributor: see their own conflicts (so they know a queued sale was flagged).
// Admin/Manager: see everyone's (default) or filter by ?distributorId.
conflictsRouter.get("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const conditions: any[] = [];
  if (req.user!.role === "distributor") {
    conditions.push(eq(schema.saleConflicts.distributorId, req.user!.id));
  } else if (req.query.distributorId) {
    conditions.push(eq(schema.saleConflicts.distributorId, Number(req.query.distributorId)));
  }
  if (typeof req.query.status === "string" && req.query.status !== "all") {
    conditions.push(eq(schema.saleConflicts.status, req.query.status as any));
  }

  const rows = await db.select({
    id: schema.saleConflicts.id,
    quantity: schema.saleConflicts.quantity,
    unitPrice: schema.saleConflicts.unitPrice,
    totalValue: schema.saleConflicts.totalValue,
    paymentType: schema.saleConflicts.paymentType,
    isDiscounted: schema.saleConflicts.isDiscounted,
    heldAtSync: schema.saleConflicts.heldAtSync,
    clientLoggedAt: schema.saleConflicts.clientLoggedAt,
    clientId: schema.saleConflicts.clientId,
    status: schema.saleConflicts.status,
    resolvedAt: schema.saleConflicts.resolvedAt,
    createdAt: schema.saleConflicts.createdAt,
    bookId: schema.books.id,
    bookTitle: schema.books.title,
    distributorName: schema.users.name,
    distributorId: schema.saleConflicts.distributorId,
  }).from(schema.saleConflicts)
    .innerJoin(schema.books, eq(schema.saleConflicts.bookId, schema.books.id))
    .innerJoin(schema.users, eq(schema.saleConflicts.distributorId, schema.users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.saleConflicts.createdAt))
    .limit(200);
  res.json(rows);
}));

// Count of pending conflicts (for badges).
conflictsRouter.get("/pending-count", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const conditions: any[] = [eq(schema.saleConflicts.status, "pending")];
  if (req.user!.role === "distributor") conditions.push(eq(schema.saleConflicts.distributorId, req.user!.id));
  const rows = await db.select({ id: schema.saleConflicts.id }).from(schema.saleConflicts).where(and(...conditions));
  res.json({ count: rows.length });
}));

const Resolve = z.object({
  decision: z.enum(["approved", "rejected"]),
});

// Admin/Manager resolves a flagged conflict.
//  approved -> force the sale through (may drive held stock negative, which
//              admins then reconcile). We record it and audit it explicitly.
//  rejected -> drop the queued sale deliberately (acknowledged data loss).
conflictsRouter.post("/:id/resolve", requireAuth, requireRole("super_admin", "inventory_manager"), validateBody(Resolve), asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const { decision } = req.body;

  const [c] = await db.select().from(schema.saleConflicts).where(eq(schema.saleConflicts.id, id));
  if (!c) throw new HttpError(404, "NOT_FOUND", "Conflict not found");
  if (c.status !== "pending") throw new HttpError(400, "ALREADY_RESOLVED", "This conflict is already resolved");

  const [book] = await db.select().from(schema.books).where(eq(schema.books.id, c.bookId));

  if (decision === "approved") {
    const [ds] = await db.select().from(schema.distributorStock).where(and(eq(schema.distributorStock.distributorId, c.distributorId), eq(schema.distributorStock.bookId, c.bookId)));
    if (ds) {
      await db.update(schema.distributorStock).set({ quantity: ds.quantity - c.quantity }).where(eq(schema.distributorStock.id, ds.id));
    } else {
      await db.insert(schema.distributorStock).values({ distributorId: c.distributorId, bookId: c.bookId, quantity: -c.quantity });
    }
    await db.insert(schema.sales).values({
      distributorId: c.distributorId, bookId: c.bookId, quantity: c.quantity,
      unitPrice: c.unitPrice, totalValue: c.totalValue, paymentType: c.paymentType,
      isDiscounted: c.isDiscounted, clientLoggedAt: c.clientLoggedAt, clientId: c.clientId,
    });
    await logAudit(req.user!.id, "conflict_approved", "sale", `Forced ${c.quantity}x ${book?.title ?? `#${c.bookId}`} through (held was ${c.heldAtSync})`);
  } else {
    await logAudit(req.user!.id, "conflict_rejected", "sale", `Dropped queued ${c.quantity}x ${book?.title ?? `#${c.bookId}`} (held was ${c.heldAtSync})`);
  }

  const [updated] = await db.update(schema.saleConflicts)
    .set({ status: decision, resolvedById: req.user!.id, resolvedAt: new Date() })
    .where(eq(schema.saleConflicts.id, id))
    .returning();
  res.json(updated);
}));

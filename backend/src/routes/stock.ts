
import { Router } from "express";
import { z } from "zod";
import { eq, and, desc, lte, sql } from "drizzle-orm";
import { db, schema } from "../db/client";
import { validateBody } from "../middleware/validate";
import { HttpError, asyncHandler } from "../lib/httpError";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth";
import { logAudit } from "../lib/audit";

export const stockRouter = Router();

// Assign warehouse -> distributor
const Assign = z.object({
  bookId: z.coerce.number().int(),
  distributorId: z.coerce.number().int(),
  quantity: z.coerce.number().int().positive(),
});

stockRouter.post("/assign", requireAuth, requireRole("super_admin", "inventory_manager"), validateBody(Assign), asyncHandler(async (req: AuthedRequest, res) => {
  const { bookId, distributorId, quantity } = req.body;
  const [book] = await db.select().from(schema.books).where(eq(schema.books.id, bookId));
  if (!book) throw new HttpError(404, "NOT_FOUND", "Book not found");
  if (book.warehouseStock < quantity) throw new HttpError(400, "INSUFFICIENT_STOCK", `Only ${book.warehouseStock} in warehouse`);

  const [dist] = await db.select().from(schema.users).where(and(eq(schema.users.id, distributorId), eq(schema.users.role, "distributor")));
  if (!dist) throw new HttpError(404, "NOT_FOUND", "Distributor not found");

  await db.update(schema.books).set({ warehouseStock: book.warehouseStock - quantity }).where(eq(schema.books.id, bookId));

  const [ds] = await db.select().from(schema.distributorStock).where(and(eq(schema.distributorStock.distributorId, distributorId), eq(schema.distributorStock.bookId, bookId)));
  if (ds) {
    await db.update(schema.distributorStock).set({ quantity: ds.quantity + quantity }).where(eq(schema.distributorStock.id, ds.id));
  } else {
    await db.insert(schema.distributorStock).values({ distributorId, bookId, quantity });
  }

  await db.insert(schema.stockMovements).values({ bookId, distributorId, quantity, type: "assign", movedById: req.user!.id });
  await logAudit(req.user!.id, "assign", "stock", `${quantity}x ${book.title} → ${dist.name}`);
  res.status(201).json({ ok: true });
}));

// Return distributor -> warehouse (or write-off if damaged)
const Return = z.object({
  bookId: z.coerce.number().int(),
  distributorId: z.coerce.number().int(),
  quantity: z.coerce.number().int().positive(),
  reason: z.enum(["unsold", "damaged", "reassigned"]).default("unsold"),
});

stockRouter.post("/return", requireAuth, requireRole("super_admin", "inventory_manager"), validateBody(Return), asyncHandler(async (req: AuthedRequest, res) => {
  const { bookId, distributorId, quantity, reason } = req.body;
  const [book] = await db.select().from(schema.books).where(eq(schema.books.id, bookId));
  if (!book) throw new HttpError(404, "NOT_FOUND", "Book not found");

  const [dist] = await db.select().from(schema.users).where(and(eq(schema.users.id, distributorId), eq(schema.users.role, "distributor")));
  if (!dist) throw new HttpError(404, "NOT_FOUND", "Distributor not found");

  const [ds] = await db.select().from(schema.distributorStock).where(and(eq(schema.distributorStock.distributorId, distributorId), eq(schema.distributorStock.bookId, bookId)));
  const held = ds?.quantity ?? 0;
  if (held < quantity) throw new HttpError(400, "INSUFFICIENT_STOCK", `Distributor only holds ${held} of this title`);

  // Reduce distributor holdings
  await db.update(schema.distributorStock).set({ quantity: held - quantity }).where(eq(schema.distributorStock.id, ds!.id));

  if (reason === "damaged") {
    // Route to write-off count, NOT sellable warehouse stock
    await db.update(schema.books).set({ writeOffStock: book.writeOffStock + quantity }).where(eq(schema.books.id, bookId));
  } else {
    await db.update(schema.books).set({ warehouseStock: book.warehouseStock + quantity }).where(eq(schema.books.id, bookId));
  }

  // Log as a return in movement history (negative-flagged via type). Quantity stored positive; type distinguishes direction.
  await db.insert(schema.stockMovements).values({ bookId, distributorId, quantity, type: "return", reason, movedById: req.user!.id });
  await logAudit(req.user!.id, "return", "stock", `${quantity}x ${book.title} ← ${dist.name} (${reason})`);
  res.status(201).json({ ok: true });
}));

// Reconciliation: enter a physical count, correct system count, log everything
const Reconcile = z.object({
  bookId: z.coerce.number().int(),
  // scope: "warehouse" or a distributorId (per-distributor count)
  distributorId: z.coerce.number().int().nullable().optional(),
  physicalCount: z.coerce.number().int().nonnegative(),
  note: z.string().max(500).nullable().optional(),
});

stockRouter.post("/reconcile", requireAuth, requireRole("super_admin", "inventory_manager"), validateBody(Reconcile), asyncHandler(async (req: AuthedRequest, res) => {
  const { bookId, distributorId, physicalCount, note } = req.body;
  const [book] = await db.select().from(schema.books).where(eq(schema.books.id, bookId));
  if (!book) throw new HttpError(404, "NOT_FOUND", "Book not found");

  if (distributorId) {
    const [dist] = await db.select().from(schema.users).where(and(eq(schema.users.id, distributorId), eq(schema.users.role, "distributor")));
    if (!dist) throw new HttpError(404, "NOT_FOUND", "Distributor not found");
    const [ds] = await db.select().from(schema.distributorStock).where(and(eq(schema.distributorStock.distributorId, distributorId), eq(schema.distributorStock.bookId, bookId)));
    const oldCount = ds?.quantity ?? 0;
    if (ds) {
      await db.update(schema.distributorStock).set({ quantity: physicalCount }).where(eq(schema.distributorStock.id, ds.id));
    } else {
      await db.insert(schema.distributorStock).values({ distributorId, bookId, quantity: physicalCount });
    }
    const variance = physicalCount - oldCount;
    await logAudit(req.user!.id, "reconcile", "stock",
      `${book.title} · ${dist.name} · system ${oldCount} → physical ${physicalCount} (var ${variance >= 0 ? "+" : ""}${variance})${note ? ` · ${note}` : ""}`);
    res.status(201).json({ ok: true, oldCount, newCount: physicalCount, variance });
    return;
  }

  // Warehouse reconciliation
  const oldCount = book.warehouseStock;
  await db.update(schema.books).set({ warehouseStock: physicalCount }).where(eq(schema.books.id, bookId));
  const variance = physicalCount - oldCount;
  await logAudit(req.user!.id, "reconcile", "stock",
    `${book.title} · Warehouse · system ${oldCount} → physical ${physicalCount} (var ${variance >= 0 ? "+" : ""}${variance})${note ? ` · ${note}` : ""}`);
  res.status(201).json({ ok: true, oldCount, newCount: physicalCount, variance });
}));

// Low-stock: books at or below their reorder threshold (admin/manager)
stockRouter.get("/low-stock", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (_req, res) => {
  const rows = await db.select({
    id: schema.books.id,
    title: schema.books.title,
    sku: schema.books.sku,
    warehouseStock: schema.books.warehouseStock,
    reorderThreshold: schema.books.reorderThreshold,
    writeOffStock: schema.books.writeOffStock,
  }).from(schema.books)
    .where(and(eq(schema.books.active, true), lte(schema.books.warehouseStock, schema.books.reorderThreshold)))
    .orderBy(schema.books.warehouseStock);
  res.json(rows);
}));

// Distributor stock (own for distributor, or by ?distributorId for admin/manager)
stockRouter.get("/holdings", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  let distId = req.user!.id;
  if (req.user!.role !== "distributor" && req.query.distributorId) {
    distId = Number(req.query.distributorId);
  }
  const rows = await db.select({
    id: schema.distributorStock.id,
    bookId: schema.books.id,
    quantity: schema.distributorStock.quantity,
    title: schema.books.title,
    sku: schema.books.sku,
    category: schema.books.category,
    language: schema.books.language,
    retailPrice: schema.books.retailPrice,
  }).from(schema.distributorStock)
    .innerJoin(schema.books, eq(schema.distributorStock.bookId, schema.books.id))
    .where(eq(schema.distributorStock.distributorId, distId))
    .orderBy(schema.books.title);
  res.json(rows);
}));

// Movement history (assignments + returns)
stockRouter.get("/movements", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (_req, res) => {
  const rows = await db.select({
    id: schema.stockMovements.id,
    quantity: schema.stockMovements.quantity,
    type: schema.stockMovements.type,
    reason: schema.stockMovements.reason,
    createdAt: schema.stockMovements.createdAt,
    bookTitle: schema.books.title,
    distributorName: schema.users.name,
  }).from(schema.stockMovements)
    .innerJoin(schema.books, eq(schema.stockMovements.bookId, schema.books.id))
    .innerJoin(schema.users, eq(schema.stockMovements.distributorId, schema.users.id))
    .orderBy(desc(schema.stockMovements.createdAt))
    .limit(100);
  res.json(rows);
}));

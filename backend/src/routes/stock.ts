
import { Router } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
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

  await db.insert(schema.stockMovements).values({ bookId, distributorId, quantity, movedById: req.user!.id });
  await logAudit(req.user!.id, "assign", "stock", `${quantity}x ${book.title} → ${dist.name}`);
  res.status(201).json({ ok: true });
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

// Movement history
stockRouter.get("/movements", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (req, res) => {
  const rows = await db.select({
    id: schema.stockMovements.id,
    quantity: schema.stockMovements.quantity,
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

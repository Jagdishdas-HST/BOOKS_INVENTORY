
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

  await db.insert(schema.stockMovements).values({ bookId, distributorId, quantity, type: "assign", movedById: req.user!.id });
  await logAudit(req.user!.id, "assign", "stock", `${quantity}x ${book.title} → ${dist.name}`);
  res.status(201).json({ ok: true });
}));

// Distributor -> Distributor transfer (does NOT route through warehouse).
const Transfer = z.object({
  bookId: z.coerce.number().int(),
  fromDistributorId: z.coerce.number().int(),
  toDistributorId: z.coerce.number().int(),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().max(300).nullable().optional(),
});

stockRouter.post("/transfer", requireAuth, requireRole("super_admin", "inventory_manager"), validateBody(Transfer), asyncHandler(async (req: AuthedRequest, res) => {
  const { bookId, fromDistributorId, toDistributorId, quantity, reason } = req.body;
  if (fromDistributorId === toDistributorId) throw new HttpError(400, "BAD_REQUEST", "Source and destination must differ");

  const [book] = await db.select().from(schema.books).where(eq(schema.books.id, bookId));
  if (!book) throw new HttpError(404, "NOT_FOUND", "Book not found");

  const [fromDist] = await db.select().from(schema.users).where(and(eq(schema.users.id, fromDistributorId), eq(schema.users.role, "distributor")));
  if (!fromDist) throw new HttpError(404, "NOT_FOUND", "Source distributor not found");
  const [toDist] = await db.select().from(schema.users).where(and(eq(schema.users.id, toDistributorId), eq(schema.users.role, "distributor")));
  if (!toDist) throw new HttpError(404, "NOT_FOUND", "Destination distributor not found");

  const [fromDs] = await db.select().from(schema.distributorStock).where(and(eq(schema.distributorStock.distributorId, fromDistributorId), eq(schema.distributorStock.bookId, bookId)));
  if (!fromDs || fromDs.quantity < quantity) throw new HttpError(400, "INSUFFICIENT_STOCK", `${fromDist.name} only holds ${fromDs?.quantity ?? 0}`);

  // Decrease source.
  await db.update(schema.distributorStock).set({ quantity: fromDs.quantity - quantity }).where(eq(schema.distributorStock.id, fromDs.id));

  // Increase destination.
  const [toDs] = await db.select().from(schema.distributorStock).where(and(eq(schema.distributorStock.distributorId, toDistributorId), eq(schema.distributorStock.bookId, bookId)));
  if (toDs) {
    await db.update(schema.distributorStock).set({ quantity: toDs.quantity + quantity }).where(eq(schema.distributorStock.id, toDs.id));
  } else {
    await db.insert(schema.distributorStock).values({ distributorId: toDistributorId, bookId, quantity });
  }

  await db.insert(schema.stockMovements).values({
    bookId, distributorId: fromDistributorId, toDistributorId, quantity, type: "transfer", reason: reason ?? null, movedById: req.user!.id,
  });
  await logAudit(req.user!.id, "transfer", "stock", `${quantity}x ${book.title}: ${fromDist.name} → ${toDist.name}${reason ? ` (${reason})` : ""}`);
  res.status(201).json({ ok: true });
}));

// Bulk stock intake (new print run received into warehouse)
const Intake = z.object({
  bookId: z.coerce.number().int(),
  quantity: z.coerce.number().int().positive(),
  reference: z.string().min(1).max(300).nullable().optional(),
});

stockRouter.post("/intake", requireAuth, requireRole("super_admin", "inventory_manager"), validateBody(Intake), asyncHandler(async (req: AuthedRequest, res) => {
  const { bookId, quantity, reference } = req.body;
  const [book] = await db.select().from(schema.books).where(eq(schema.books.id, bookId));
  if (!book) throw new HttpError(404, "NOT_FOUND", "Book not found");

  await db.update(schema.books).set({ warehouseStock: book.warehouseStock + quantity }).where(eq(schema.books.id, bookId));

  await db.insert(schema.stockMovements).values({
    bookId, distributorId: null, quantity, type: "stock_in", reason: reference ?? null, movedById: req.user!.id,
  });
  await logAudit(req.user!.id, "stock_in", "stock", `+${quantity}x ${book.title} received${reference ? ` (ref: ${reference})` : ""}`);
  res.status(201).json({ ok: true });
}));

// Return distributor -> warehouse (with damaged write-off routing)
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
  const [dist] = await db.select().from(schema.users).where(eq(schema.users.id, distributorId));
  if (!dist) throw new HttpError(404, "NOT_FOUND", "Distributor not found");

  const [ds] = await db.select().from(schema.distributorStock).where(and(eq(schema.distributorStock.distributorId, distributorId), eq(schema.distributorStock.bookId, bookId)));
  if (!ds || ds.quantity < quantity) throw new HttpError(400, "INSUFFICIENT_STOCK", `Distributor only holds ${ds?.quantity ?? 0}`);

  await db.update(schema.distributorStock).set({ quantity: ds.quantity - quantity }).where(eq(schema.distributorStock.id, ds.id));

  if (reason === "damaged") {
    await db.update(schema.books).set({ writeOffStock: book.writeOffStock + quantity }).where(eq(schema.books.id, bookId));
  } else {
    await db.update(schema.books).set({ warehouseStock: book.warehouseStock + quantity }).where(eq(schema.books.id, bookId));
  }

  await db.insert(schema.stockMovements).values({ bookId, distributorId, quantity, type: "return", reason, movedById: req.user!.id });
  await logAudit(req.user!.id, "return", "stock", `${quantity}x ${book.title} ← ${dist.name} (${reason})`);
  res.status(201).json({ ok: true });
}));

// Reconciliation adjustment
const Reconcile = z.object({
  bookId: z.coerce.number().int(),
  physicalCount: z.coerce.number().int().nonnegative(),
  note: z.string().max(300).nullable().optional(),
});

stockRouter.post("/reconcile", requireAuth, requireRole("super_admin", "inventory_manager"), validateBody(Reconcile), asyncHandler(async (req: AuthedRequest, res) => {
  const { bookId, physicalCount, note } = req.body;
  const [book] = await db.select().from(schema.books).where(eq(schema.books.id, bookId));
  if (!book) throw new HttpError(404, "NOT_FOUND", "Book not found");
  const oldCount = book.warehouseStock;
  const diff = physicalCount - oldCount;

  await db.update(schema.books).set({ warehouseStock: physicalCount }).where(eq(schema.books.id, bookId));
  await db.insert(schema.stockMovements).values({ bookId, distributorId: null, quantity: diff, type: "adjust", reason: note ?? null, movedById: req.user!.id });
  await logAudit(req.user!.id, "adjust", "stock", `${book.title}: ${oldCount} → ${physicalCount}${note ? ` (${note})` : ""}`);
  res.status(201).json({ ok: true });
}));

// Low stock books (at or below threshold)
stockRouter.get("/low-stock", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (_req, res) => {
  const all = await db.select().from(schema.books).where(eq(schema.books.active, true));
  const low = all.filter((b) => b.warehouseStock <= b.reorderThreshold);
  res.json(low);
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
    coverUrl: schema.books.coverUrl,
    isbn: schema.books.isbn,
  }).from(schema.distributorStock)
    .innerJoin(schema.books, eq(schema.distributorStock.bookId, schema.books.id))
    .where(eq(schema.distributorStock.distributorId, distId))
    .orderBy(schema.books.title);
  res.json(rows);
}));

// Movement history
stockRouter.get("/movements", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (_req, res) => {
  const toUsers = schema.users;
  const rows = await db.select({
    id: schema.stockMovements.id,
    quantity: schema.stockMovements.quantity,
    type: schema.stockMovements.type,
    reason: schema.stockMovements.reason,
    createdAt: schema.stockMovements.createdAt,
    bookTitle: schema.books.title,
    distributorName: schema.users.name,
    toDistributorId: schema.stockMovements.toDistributorId,
  }).from(schema.stockMovements)
    .innerJoin(schema.books, eq(schema.stockMovements.bookId, schema.books.id))
    .leftJoin(schema.users, eq(schema.stockMovements.distributorId, schema.users.id))
    .orderBy(desc(schema.stockMovements.createdAt))
    .limit(100);

  // Resolve destination distributor names for transfers.
  const toIds = Array.from(new Set(rows.map((r) => r.toDistributorId).filter((x): x is number => !!x)));
  let toNames: Record<number, string> = {};
  if (toIds.length > 0) {
    const toRows = await db.select({ id: toUsers.id, name: toUsers.name }).from(toUsers);
    toNames = Object.fromEntries(toRows.map((u) => [u.id, u.name]));
  }
  const enriched = rows.map((r) => ({
    ...r,
    toDistributorName: r.toDistributorId ? (toNames[r.toDistributorId] ?? null) : null,
  }));
  res.json(enriched);
}));

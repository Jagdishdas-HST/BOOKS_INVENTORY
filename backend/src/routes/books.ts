
import { Router } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../db/client";
import { validateBody } from "../middleware/validate";
import { HttpError, asyncHandler } from "../lib/httpError";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth";
import { logAudit } from "../lib/audit";

export const booksRouter = Router();

booksRouter.get("/", requireAuth, asyncHandler(async (_req, res) => {
  const rows = await db.select().from(schema.books).orderBy(schema.books.title);
  res.json(rows);
}));

booksRouter.get("/lookup/:isbn", requireAuth, asyncHandler(async (req, res) => {
  const isbn = String(req.params.isbn).trim();
  const [row] = await db.select().from(schema.books).where(eq(schema.books.isbn, isbn));
  if (!row) throw new HttpError(404, "NOT_FOUND", "No book matches that barcode");
  res.json(row);
}));

booksRouter.get("/:id/price-history", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const rows = await db.select({
    id: schema.priceHistory.id,
    field: schema.priceHistory.field,
    oldValue: schema.priceHistory.oldValue,
    newValue: schema.priceHistory.newValue,
    createdAt: schema.priceHistory.createdAt,
    changedByName: schema.users.name,
  }).from(schema.priceHistory)
    .innerJoin(schema.users, eq(schema.priceHistory.changedById, schema.users.id))
    .where(eq(schema.priceHistory.bookId, id))
    .orderBy(desc(schema.priceHistory.createdAt))
    .limit(200);
  res.json(rows);
}));

const CreateBook = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  language: z.string().min(1).default("English"),
  costPrice: z.coerce.number().nonnegative(),
  retailPrice: z.coerce.number().nonnegative(),
  warehouseStock: z.coerce.number().int().nonnegative().default(0),
  reorderThreshold: z.coerce.number().int().nonnegative().optional(),
  isbn: z.string().min(1).nullable().optional(),
  coverUrl: z.string().min(1).nullable().optional(),
  coverKey: z.string().min(1).nullable().optional(),
});

booksRouter.post("/", requireAuth, requireRole("super_admin", "inventory_manager"), validateBody(CreateBook), asyncHandler(async (req: AuthedRequest, res) => {
  const b = req.body;
  const [existing] = await db.select().from(schema.books).where(eq(schema.books.sku, b.sku));
  if (existing) throw new HttpError(400, "DUPLICATE", "SKU already exists");
  const [row] = await db.insert(schema.books).values({
    sku: b.sku, title: b.title, category: b.category, language: b.language,
    costPrice: String(b.costPrice), retailPrice: String(b.retailPrice), warehouseStock: b.warehouseStock,
    reorderThreshold: b.reorderThreshold ?? 20,
    isbn: b.isbn ?? null, coverUrl: b.coverUrl ?? null, coverKey: b.coverKey ?? null,
  }).returning();
  // Critical audit: new book — actor name, ID, book title, SKU, new record ID
  await logAudit(
    req.user!.id,
    "create",
    "book",
    `"${req.user!.name}" (ID: ${req.user!.id}) added book "${row.title}" (SKU: ${row.sku}, ID: ${row.id})`,
  );
  res.status(201).json(row);
}));

const UpdateBook = z.object({
  title: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  costPrice: z.coerce.number().nonnegative().optional(),
  retailPrice: z.coerce.number().nonnegative().optional(),
  warehouseStock: z.coerce.number().int().nonnegative().optional(),
  reorderThreshold: z.coerce.number().int().nonnegative().optional(),
  isbn: z.string().min(1).nullable().optional(),
  coverUrl: z.string().min(1).nullable().optional(),
  coverKey: z.string().min(1).nullable().optional(),
  active: z.coerce.boolean().optional(),
});

booksRouter.patch("/:id", requireAuth, requireRole("super_admin", "inventory_manager"), validateBody(UpdateBook), asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body;
  const [current] = await db.select().from(schema.books).where(eq(schema.books.id, id));
  if (!current) throw new HttpError(404, "NOT_FOUND", "Book not found");

  const patch: any = {};
  if (b.title !== undefined) patch.title = b.title;
  if (b.category !== undefined) patch.category = b.category;
  if (b.language !== undefined) patch.language = b.language;
  if (b.warehouseStock !== undefined) patch.warehouseStock = b.warehouseStock;
  if (b.reorderThreshold !== undefined) patch.reorderThreshold = b.reorderThreshold;
  if (b.isbn !== undefined) patch.isbn = b.isbn;
  if (b.coverUrl !== undefined) patch.coverUrl = b.coverUrl;
  if (b.coverKey !== undefined) patch.coverKey = b.coverKey;
  if (b.active !== undefined) patch.active = b.active;

  // Track price changes with full audit trail
  const priceLogs: { field: "cost_price" | "retail_price"; oldValue: string; newValue: string }[] = [];
  if (b.costPrice !== undefined && Number(current.costPrice) !== b.costPrice) {
    patch.costPrice = String(b.costPrice);
    priceLogs.push({ field: "cost_price", oldValue: String(current.costPrice), newValue: String(b.costPrice) });
  }
  if (b.retailPrice !== undefined && Number(current.retailPrice) !== b.retailPrice) {
    patch.retailPrice = String(b.retailPrice);
    priceLogs.push({ field: "retail_price", oldValue: String(current.retailPrice), newValue: String(b.retailPrice) });
  }

  const [row] = await db.update(schema.books).set(patch).where(eq(schema.books.id, id)).returning();

  for (const p of priceLogs) {
    await db.insert(schema.priceHistory).values({
      bookId: id, field: p.field, oldValue: p.oldValue, newValue: p.newValue, changedById: req.user!.id,
    });
    const label = p.field === "cost_price" ? "cost" : "retail";
    // Critical audit: price change — actor, book title, ID, old→new, date
    await logAudit(
      req.user!.id,
      "price_change",
      "book",
      `"${req.user!.name}" (ID: ${req.user!.id}) changed ${label} price of "${row.title}" (ID: ${row.id}): ₹${p.oldValue} → ₹${p.newValue}`,
    );
  }

  // Critical audit: book update — actor, book title, ID
  await logAudit(
    req.user!.id,
    "update",
    "book",
    `"${req.user!.name}" (ID: ${req.user!.id}) updated book "${row.title}" (ID: ${row.id})`,
  );
  res.json(row);
}));

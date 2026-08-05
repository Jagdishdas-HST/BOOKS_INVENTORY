
import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
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

const CreateBook = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  language: z.string().min(1).default("English"),
  costPrice: z.coerce.number().nonnegative(),
  retailPrice: z.coerce.number().nonnegative(),
  warehouseStock: z.coerce.number().int().nonnegative().default(0),
});

booksRouter.post("/", requireAuth, requireRole("super_admin", "inventory_manager"), validateBody(CreateBook), asyncHandler(async (req: AuthedRequest, res) => {
  const b = req.body;
  const [existing] = await db.select().from(schema.books).where(eq(schema.books.sku, b.sku));
  if (existing) throw new HttpError(400, "DUPLICATE", "SKU already exists");
  const [row] = await db.insert(schema.books).values({
    sku: b.sku, title: b.title, category: b.category, language: b.language,
    costPrice: String(b.costPrice), retailPrice: String(b.retailPrice), warehouseStock: b.warehouseStock,
  }).returning();
  await logAudit(req.user!.id, "create", "book", `${row.title} (${row.sku})`);
  res.status(201).json(row);
}));

const UpdateBook = z.object({
  title: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  costPrice: z.coerce.number().nonnegative().optional(),
  retailPrice: z.coerce.number().nonnegative().optional(),
  warehouseStock: z.coerce.number().int().nonnegative().optional(),
  active: z.coerce.boolean().optional(),
});

booksRouter.patch("/:id", requireAuth, requireRole("super_admin", "inventory_manager"), validateBody(UpdateBook), asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body;
  const patch: any = {};
  if (b.title !== undefined) patch.title = b.title;
  if (b.category !== undefined) patch.category = b.category;
  if (b.language !== undefined) patch.language = b.language;
  if (b.costPrice !== undefined) patch.costPrice = String(b.costPrice);
  if (b.retailPrice !== undefined) patch.retailPrice = String(b.retailPrice);
  if (b.warehouseStock !== undefined) patch.warehouseStock = b.warehouseStock;
  if (b.active !== undefined) patch.active = b.active;
  const [row] = await db.update(schema.books).set(patch).where(eq(schema.books.id, id)).returning();
  if (!row) throw new HttpError(404, "NOT_FOUND", "Book not found");
  await logAudit(req.user!.id, "update", "book", `${row.title}`);
  res.json(row);
}));


import { Router } from "express";
import { or, ilike, eq, desc, and } from "drizzle-orm";
import { db, schema } from "../db/client";
import { asyncHandler } from "../lib/httpError";
import { requireAuth, type AuthedRequest } from "../lib/auth";

export const searchRouter = Router();

// Role-aware global search.
//   - Everyone: book catalog (title, SKU, ISBN).
//   - Admin/Manager: also sales (all) + distributor records.
//   - Distributor: also THEIR OWN sales & remittances only.
searchRouter.get("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) {
    res.json({ books: [], sales: [], distributors: [], remittances: [] });
    return;
  }
  const like = `%${q}%`;
  const isAdmin = req.user!.role === "super_admin" || req.user!.role === "inventory_manager";

  const books = await db.select({
    id: schema.books.id,
    title: schema.books.title,
    sku: schema.books.sku,
    isbn: schema.books.isbn,
    category: schema.books.category,
    retailPrice: schema.books.retailPrice,
    warehouseStock: schema.books.warehouseStock,
    coverUrl: schema.books.coverUrl,
  }).from(schema.books)
    .where(or(ilike(schema.books.title, like), ilike(schema.books.sku, like), ilike(schema.books.isbn, like)))
    .orderBy(schema.books.title)
    .limit(25);

  let sales: any[] = [];
  let distributors: any[] = [];
  let remittances: any[] = [];

  if (isAdmin) {
    sales = await db.select({
      id: schema.sales.id,
      quantity: schema.sales.quantity,
      totalValue: schema.sales.totalValue,
      paymentType: schema.sales.paymentType,
      createdAt: schema.sales.createdAt,
      bookTitle: schema.books.title,
      distributorId: schema.sales.distributorId,
      distributorName: schema.users.name,
    }).from(schema.sales)
      .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
      .innerJoin(schema.users, eq(schema.sales.distributorId, schema.users.id))
      .where(or(ilike(schema.books.title, like), ilike(schema.users.name, like)))
      .orderBy(desc(schema.sales.createdAt))
      .limit(25);

    distributors = await db.select({
      id: schema.users.id,
      name: schema.users.name,
      username: schema.users.username,
      active: schema.users.active,
    }).from(schema.users)
      .where(and(eq(schema.users.role, "distributor"), or(ilike(schema.users.name, like), ilike(schema.users.username, like))))
      .orderBy(schema.users.name)
      .limit(25);
  } else {
    // Distributor: strictly their OWN sales & remittances.
    const distId = req.user!.id;
    sales = await db.select({
      id: schema.sales.id,
      quantity: schema.sales.quantity,
      totalValue: schema.sales.totalValue,
      paymentType: schema.sales.paymentType,
      createdAt: schema.sales.createdAt,
      bookTitle: schema.books.title,
      distributorId: schema.sales.distributorId,
    }).from(schema.sales)
      .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
      .where(and(eq(schema.sales.distributorId, distId), ilike(schema.books.title, like)))
      .orderBy(desc(schema.sales.createdAt))
      .limit(25);

    remittances = await db.select({
      id: schema.remittances.id,
      amount: schema.remittances.amount,
      note: schema.remittances.note,
      createdAt: schema.remittances.createdAt,
    }).from(schema.remittances)
      .where(and(eq(schema.remittances.distributorId, distId), ilike(schema.remittances.note, like)))
      .orderBy(desc(schema.remittances.createdAt))
      .limit(25);
  }

  res.json({ books, sales, distributors, remittances });
}));

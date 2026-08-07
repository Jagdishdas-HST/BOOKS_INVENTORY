
import { Router } from "express";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, schema } from "../db/client";
import { validateBody } from "../middleware/validate";
import { HttpError, asyncHandler } from "../lib/httpError";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { logAudit } from "../lib/audit";

export const salesRouter = Router();

const CreateSale = z.object({
  bookId: z.coerce.number().int(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  // Fourth option added: "free" for complimentary distribution.
  paymentType: z.enum(["cash", "online", "debt", "free"]),
});

salesRouter.post("/", requireAuth, validateBody(CreateSale), asyncHandler(async (req: AuthedRequest, res) => {
  if (req.user!.role !== "distributor") throw new HttpError(403, "FORBIDDEN", "Only distributors log sales");
  const { bookId, quantity, paymentType } = req.body;
  const distId = req.user!.id;

  const [ds] = await db.select().from(schema.distributorStock).where(and(eq(schema.distributorStock.distributorId, distId), eq(schema.distributorStock.bookId, bookId)));
  if (!ds || ds.quantity < quantity) throw new HttpError(400, "INSUFFICIENT_STOCK", `You only hold ${ds?.quantity ?? 0} copies`);

  const [book] = await db.select().from(schema.books).where(eq(schema.books.id, bookId));
  if (!book) throw new HttpError(400, "BAD_REQUEST", "Book not found");

  await db.update(schema.distributorStock).set({ quantity: ds.quantity - quantity }).where(eq(schema.distributorStock.id, ds.id));

  // Free distributions reduce stock but carry $0 value and are never a debt.
  const isFree = paymentType === "free";
  const retail = parseFloat(book.retailPrice);
  const unitPrice = isFree ? 0 : req.body.unitPrice;
  // A discounted paid sale: charged below retail (not free).
  const isDiscounted = !isFree && unitPrice < retail;
  const total = isFree ? 0 : quantity * unitPrice;

  const [row] = await db.insert(schema.sales).values({
    distributorId: distId, bookId, quantity,
    unitPrice: String(unitPrice), totalValue: String(total),
    paymentType, isDiscounted,
  }).returning();

  const tag = isFree ? "FREE" : isDiscounted ? `${paymentType} discounted` : paymentType;
  await logAudit(distId, "sale", "sale", `${quantity}x book #${bookId} (${tag}) ₹${total}`);
  res.status(201).json(row);
}));

// Sales history (own for distributor, all/by-dist for admin)
salesRouter.get("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  let distId = req.user!.id;
  if (req.user!.role !== "distributor" && req.query.distributorId) {
    distId = Number(req.query.distributorId);
  }
  const rows = await db.select({
    id: schema.sales.id,
    quantity: schema.sales.quantity,
    unitPrice: schema.sales.unitPrice,
    totalValue: schema.sales.totalValue,
    paymentType: schema.sales.paymentType,
    isDiscounted: schema.sales.isDiscounted,
    createdAt: schema.sales.createdAt,
    bookTitle: schema.books.title,
    sku: schema.books.sku,
    retailPrice: schema.books.retailPrice,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(eq(schema.sales.distributorId, distId))
    .orderBy(desc(schema.sales.createdAt))
    .limit(100);
  res.json(rows);
}));

// Balance summary for a distributor — UNCHANGED default behavior. Free sales
// (payment_type='free') carry $0 value and never appear in any of these
// aggregations, so they don't touch outstanding.
salesRouter.get("/balance", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  let distId = req.user!.id;
  if (req.user!.role !== "distributor" && req.query.distributorId) {
    distId = Number(req.query.distributorId);
  }
  const [debtRow] = await db.select({ total: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)` })
    .from(schema.sales)
    .where(and(eq(schema.sales.distributorId, distId), eq(schema.sales.paymentType, "debt")));
  const [remitRow] = await db.select({ total: sql<string>`COALESCE(SUM(${schema.remittances.amount}),0)` })
    .from(schema.remittances)
    .where(eq(schema.remittances.distributorId, distId));
  const [cashRow] = await db.select({ total: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)` })
    .from(schema.sales)
    .where(and(eq(schema.sales.distributorId, distId), eq(schema.sales.paymentType, "cash")));
  const [onlineRow] = await db.select({ total: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)` })
    .from(schema.sales)
    .where(and(eq(schema.sales.distributorId, distId), eq(schema.sales.paymentType, "online")));
  const [freeRow] = await db.select({
    copies: sql<string>`COALESCE(SUM(${schema.sales.quantity}),0)`,
  }).from(schema.sales)
    .where(and(eq(schema.sales.distributorId, distId), eq(schema.sales.paymentType, "free")));
  const [discRow] = await db.select({
    total: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)`,
  }).from(schema.sales)
    .where(and(eq(schema.sales.distributorId, distId), eq(schema.sales.isDiscounted, true)));

  const debt = parseFloat(debtRow.total);
  const remitted = parseFloat(remitRow.total);
  res.json({
    debtTotal: debt,
    remittedTotal: remitted,
    outstanding: debt - remitted,
    cashTotal: parseFloat(cashRow.total),
    onlineTotal: parseFloat(onlineRow.total),
    freeCopies: parseInt(freeRow.copies, 10),
    discountedTotal: parseFloat(discRow.total),
  });
}));

// Outstanding (unallocated) debt sales for a distributor — used by the
// allocation UI. Returns each debt sale with how much of it is still
// unallocated across all remittances.
salesRouter.get("/debt-open", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  let distId = req.user!.id;
  if (req.user!.role !== "distributor" && req.query.distributorId) {
    distId = Number(req.query.distributorId);
  }
  const rows = await db.select({
    id: schema.sales.id,
    quantity: schema.sales.quantity,
    totalValue: schema.sales.totalValue,
    createdAt: schema.sales.createdAt,
    bookTitle: schema.books.title,
    allocated: sql<string>`COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.sale_id = ${schema.sales.id}),0)`,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(and(eq(schema.sales.distributorId, distId), eq(schema.sales.paymentType, "debt")))
    .orderBy(schema.sales.createdAt); // oldest first for FIFO

  const open = rows
    .map((r) => ({
      id: r.id,
      bookTitle: r.bookTitle,
      quantity: r.quantity,
      totalValue: parseFloat(r.totalValue),
      allocated: parseFloat(r.allocated),
      remaining: parseFloat(r.totalValue) - parseFloat(r.allocated),
      createdAt: r.createdAt,
    }))
    .filter((r) => r.remaining > 0.005);
  res.json(open);
}));

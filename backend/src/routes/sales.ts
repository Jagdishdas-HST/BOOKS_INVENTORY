
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
  paymentType: z.enum(["cash", "online", "debt"]),
});

salesRouter.post("/", requireAuth, validateBody(CreateSale), asyncHandler(async (req: AuthedRequest, res) => {
  if (req.user!.role !== "distributor") throw new HttpError(403, "FORBIDDEN", "Only distributors log sales");
  const { bookId, quantity, unitPrice, paymentType } = req.body;
  const distId = req.user!.id;

  const [ds] = await db.select().from(schema.distributorStock).where(and(eq(schema.distributorStock.distributorId, distId), eq(schema.distributorStock.bookId, bookId)));
  if (!ds || ds.quantity < quantity) throw new HttpError(400, "INSUFFICIENT_STOCK", `You only hold ${ds?.quantity ?? 0} copies`);

  await db.update(schema.distributorStock).set({ quantity: ds.quantity - quantity }).where(eq(schema.distributorStock.id, ds.id));

  const total = quantity * unitPrice;
  const [row] = await db.insert(schema.sales).values({
    distributorId: distId, bookId, quantity, unitPrice: String(unitPrice), totalValue: String(total), paymentType,
  }).returning();
  await logAudit(distId, "sale", "sale", `${quantity}x book #${bookId} (${paymentType}) ₹${total}`);
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
    createdAt: schema.sales.createdAt,
    bookTitle: schema.books.title,
    sku: schema.books.sku,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(eq(schema.sales.distributorId, distId))
    .orderBy(desc(schema.sales.createdAt))
    .limit(100);
  res.json(rows);
}));

// Balance summary for a distributor
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

  const debt = parseFloat(debtRow.total);
  const remitted = parseFloat(remitRow.total);
  res.json({
    debtTotal: debt,
    remittedTotal: remitted,
    outstanding: debt - remitted,
    cashTotal: parseFloat(cashRow.total),
    onlineTotal: parseFloat(onlineRow.total),
  });
}));

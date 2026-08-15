
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
  paymentType: z.enum(["cash", "online", "debt", "free"]),
  customerId: z.coerce.number().int().nullable().optional(),
  clientLoggedAt: z.coerce.date().nullable().optional(),
  clientId: z.string().min(1).max(120).nullable().optional(),
});

salesRouter.post("/", requireAuth, validateBody(CreateSale), asyncHandler(async (req: AuthedRequest, res) => {
  if (req.user!.role !== "distributor") throw new HttpError(403, "FORBIDDEN", "Only distributors log sales");
  const { bookId, quantity, paymentType, clientLoggedAt, clientId, customerId } = req.body;
  const distId = req.user!.id;

  const [book] = await db.select().from(schema.books).where(eq(schema.books.id, bookId));
  if (!book) throw new HttpError(400, "BAD_REQUEST", "Book not found");

  // Validate customer ownership if provided.
  let resolvedCustomerId: number | null = null;
  if (customerId) {
    const [cust] = await db.select().from(schema.customers).where(eq(schema.customers.id, customerId));
    if (!cust || cust.distributorId !== distId) throw new HttpError(400, "BAD_REQUEST", "Customer not found");
    resolvedCustomerId = cust.id;
  }

  const isFree = paymentType === "free";
  const retail = parseFloat(book.retailPrice);
  const unitPrice = isFree ? 0 : req.body.unitPrice;
  const isDiscounted = !isFree && unitPrice < retail;
  const total = isFree ? 0 : quantity * unitPrice;

  if (clientId) {
    const [existingSale] = await db.select().from(schema.sales).where(eq(schema.sales.clientId, clientId));
    if (existingSale) return res.status(200).json({ status: "duplicate", sale: existingSale });
    const [existingConflict] = await db.select().from(schema.saleConflicts).where(eq(schema.saleConflicts.clientId, clientId));
    if (existingConflict) return res.status(200).json({ status: "conflict", conflict: existingConflict });
  }

  const [ds] = await db.select().from(schema.distributorStock).where(and(eq(schema.distributorStock.distributorId, distId), eq(schema.distributorStock.bookId, bookId)));
  const held = ds?.quantity ?? 0;

  if (held < quantity) {
    const [conflict] = await db.insert(schema.saleConflicts).values({
      distributorId: distId, bookId, quantity,
      unitPrice: String(unitPrice), totalValue: String(total),
      paymentType, isDiscounted, heldAtSync: held,
      clientLoggedAt: clientLoggedAt ?? null,
      clientId: clientId ?? null,
    }).returning();
    await logAudit(
      distId,
      "sale_conflict",
      "sale",
      `"${req.user!.name}" (ID: ${distId}) attempted ${quantity}x "${book.title}" (ID: ${book.id}) but only held ${held} — flagged conflict #${conflict.id}`,
    );
    return res.status(409).json({ status: "conflict", conflict });
  }

  await db.update(schema.distributorStock).set({ quantity: held - quantity }).where(eq(schema.distributorStock.id, ds!.id));

  const [row] = await db.insert(schema.sales).values({
    distributorId: distId, bookId, quantity,
    customerId: resolvedCustomerId,
    unitPrice: String(unitPrice), totalValue: String(total),
    paymentType, isDiscounted,
    clientLoggedAt: clientLoggedAt ?? null,
    clientId: clientId ?? null,
  }).returning();

  const tag = isFree ? "FREE" : isDiscounted ? `${paymentType} discounted` : paymentType;
  const offlineNote = clientLoggedAt ? ` (logged offline ${new Date(clientLoggedAt).toISOString()})` : "";
  await logAudit(
    distId,
    "sale",
    "sale",
    `"${req.user!.name}" (ID: ${distId}) sold ${quantity}x "${book.title}" (ID: ${book.id}) [${tag}] ₹${total} — Sale #${row.id}${offlineNote}`,
  );
  res.status(201).json({ status: "created", sale: row });
}));

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
    clientLoggedAt: schema.sales.clientLoggedAt,
    createdAt: schema.sales.createdAt,
    bookTitle: schema.books.title,
    sku: schema.books.sku,
    retailPrice: schema.books.retailPrice,
    customerName: schema.customers.name,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .leftJoin(schema.customers, eq(schema.sales.customerId, schema.customers.id))
    .where(eq(schema.sales.distributorId, distId))
    .orderBy(desc(schema.sales.createdAt))
    .limit(100);
  res.json(rows);
}));

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
    .orderBy(schema.sales.createdAt);

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

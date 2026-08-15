
import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "../db/client";
import { validateBody } from "../middleware/validate";
import { HttpError, asyncHandler } from "../lib/httpError";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { logAudit } from "../lib/audit";

export const customersRouter = Router();

const CreateCustomer = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["institute", "individual"]).default("individual"),
  contactPerson: z.string().max(200).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

// Admins/managers can view any distributor's customers via ?distributorId,
// distributors always see their own.
function resolveOwnerId(req: AuthedRequest): number {
  if (req.user!.role !== "distributor" && req.query.distributorId) {
    return Number(req.query.distributorId);
  }
  return req.user!.id;
}

// List customers (with purchase summary) — supports ?q= search.
customersRouter.get("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const ownerId = resolveOwnerId(req);
  const q = String(req.query.q ?? "").trim();

  const conds: any[] = [eq(schema.customers.distributorId, ownerId), eq(schema.customers.active, true)];
  if (q) {
    conds.push(or(
      ilike(schema.customers.name, `%${q}%`),
      ilike(schema.customers.contactPerson, `%${q}%`),
      ilike(schema.customers.phone, `%${q}%`),
    ));
  }

  const rows = await db.select({
    id: schema.customers.id,
    name: schema.customers.name,
    type: schema.customers.type,
    contactPerson: schema.customers.contactPerson,
    phone: schema.customers.phone,
    createdAt: schema.customers.createdAt,
    totalCopies: sql<string>`COALESCE((SELECT SUM(s.quantity) FROM sales s WHERE s.customer_id = ${schema.customers.id}),0)`,
    totalValue: sql<string>`COALESCE((SELECT SUM(s.total_value) FROM sales s WHERE s.customer_id = ${schema.customers.id}),0)`,
    lastPurchaseAt: sql<string | null>`(SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = ${schema.customers.id})`,
  }).from(schema.customers)
    .where(and(...conds))
    .orderBy(desc(schema.customers.createdAt))
    .limit(200);

  res.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    contactPerson: r.contactPerson,
    phone: r.phone,
    createdAt: r.createdAt,
    totalCopies: parseInt(r.totalCopies, 10),
    totalValue: parseFloat(r.totalValue),
    lastPurchaseAt: r.lastPurchaseAt,
  })));
}));

// Create a customer.
customersRouter.post("/", requireAuth, validateBody(CreateCustomer), asyncHandler(async (req: AuthedRequest, res) => {
  const ownerId = resolveOwnerId(req);
  const b = req.body;
  const [row] = await db.insert(schema.customers).values({
    distributorId: ownerId,
    name: b.name,
    type: b.type,
    contactPerson: b.contactPerson ?? null,
    phone: b.phone ?? null,
    email: b.email ?? null,
    address: b.address ?? null,
    note: b.note ?? null,
  }).returning();

  await logAudit(
    req.user!.id,
    "create",
    "customer",
    `Added ${b.type} customer "${b.name}" (ID: ${row.id})`,
  );
  res.status(201).json(row);
}));

// Customer detail + full purchase history.
customersRouter.get("/:id", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, id));
  if (!customer) throw new HttpError(404, "NOT_FOUND", "Customer not found");

  // Distributors can only view their own customers.
  if (req.user!.role === "distributor" && customer.distributorId !== req.user!.id) {
    throw new HttpError(403, "FORBIDDEN", "Not your customer");
  }

  const purchases = await db.select({
    id: schema.sales.id,
    quantity: schema.sales.quantity,
    unitPrice: schema.sales.unitPrice,
    totalValue: schema.sales.totalValue,
    paymentType: schema.sales.paymentType,
    isDiscounted: schema.sales.isDiscounted,
    createdAt: schema.sales.createdAt,
    bookTitle: schema.books.title,
    sku: schema.books.sku,
    coverUrl: schema.books.coverUrl,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(eq(schema.sales.customerId, id))
    .orderBy(desc(schema.sales.createdAt));

  const totalCopies = purchases.reduce((a, p) => a + p.quantity, 0);
  const totalValue = purchases.reduce((a, p) => a + parseFloat(p.totalValue), 0);

  res.json({
    customer,
    summary: {
      totalCopies,
      totalValue,
      orderCount: purchases.length,
      lastPurchaseAt: purchases[0]?.createdAt ?? null,
    },
    purchases: purchases.map((p) => ({
      ...p,
      unitPrice: parseFloat(p.unitPrice),
      totalValue: parseFloat(p.totalValue),
    })),
  });
}));

// Soft-delete a customer.
customersRouter.delete("/:id", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, id));
  if (!customer) throw new HttpError(404, "NOT_FOUND", "Customer not found");
  if (req.user!.role === "distributor" && customer.distributorId !== req.user!.id) {
    throw new HttpError(403, "FORBIDDEN", "Not your customer");
  }
  await db.update(schema.customers).set({ active: false }).where(eq(schema.customers.id, id));
  await logAudit(req.user!.id, "delete", "customer", `Removed customer "${customer.name}" (ID: ${id})`);
  res.json({ status: "ok" });
}));

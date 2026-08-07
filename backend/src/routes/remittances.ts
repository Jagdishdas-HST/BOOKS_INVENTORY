
import { Router } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "../db/client";
import { validateBody } from "../middleware/validate";
import { HttpError, asyncHandler } from "../lib/httpError";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { logAudit } from "../lib/audit";

export const remittancesRouter = Router();

const AllocationInput = z.object({
  saleId: z.coerce.number().int(),
  amount: z.coerce.number().positive(),
});

const CreateRemit = z.object({
  amount: z.coerce.number().positive(),
  note: z.string().max(300).nullable().optional(),
  allocations: z.array(AllocationInput).nullable().optional(),
});

remittancesRouter.post("/", requireAuth, validateBody(CreateRemit), asyncHandler(async (req: AuthedRequest, res) => {
  const { amount, note, allocations } = req.body;

  let distId: number;
  if (req.user!.role === "distributor") {
    distId = req.user!.id;
    if (allocations && allocations.length > 0) {
      throw new HttpError(403, "FORBIDDEN", "Only admins can allocate remittances");
    }
  } else {
    if (!req.body.distributorId && !req.query.distributorId) {
      throw new HttpError(400, "BAD_REQUEST", "distributorId is required");
    }
    distId = Number(req.body.distributorId ?? req.query.distributorId);
  }

  const [row] = await db.insert(schema.remittances).values({
    distributorId: distId, amount: String(amount), note: note ?? null,
  }).returning();

  if (allocations && allocations.length > 0) {
    const allocSum = allocations.reduce((a: number, x: any) => a + x.amount, 0);
    if (allocSum - amount > 0.005) {
      throw new HttpError(400, "BAD_REQUEST", "Allocations exceed the remittance amount");
    }
    for (const a of allocations) {
      const [sale] = await db.select().from(schema.sales).where(eq(schema.sales.id, a.saleId));
      if (!sale || sale.distributorId !== distId || sale.paymentType !== "debt") {
        throw new HttpError(400, "BAD_REQUEST", `Sale #${a.saleId} is not an eligible debt sale`);
      }
      await db.insert(schema.paymentAllocations).values({
        remittanceId: row.id, saleId: a.saleId, amount: String(a.amount), allocatedById: req.user!.id,
      });
    }
    // Critical audit: allocated remittance — actor, amount, distributor ID, sale count
    await logAudit(
      req.user!.id,
      "remittance_allocated",
      "remittance",
      `"${req.user!.name}" (ID: ${req.user!.id}) recorded Remittance #${row.id}: ₹${amount} allocated across ${allocations.length} debt sale(s) for distributor ID: ${distId}`,
    );
  } else {
    // Critical audit: remittance — actor, amount, note, distributor ID
    await logAudit(
      req.user!.id,
      "remittance",
      "remittance",
      `"${req.user!.name}" (ID: ${req.user!.id}) recorded Remittance #${row.id}: ₹${amount}${note ? ` — ${note}` : ""} (distributor ID: ${distId})`,
    );
  }

  res.status(201).json(row);
}));

remittancesRouter.get("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  let distId = req.user!.id;
  if (req.user!.role !== "distributor" && req.query.distributorId) {
    distId = Number(req.query.distributorId);
  }
  const rows = await db.select().from(schema.remittances)
    .where(eq(schema.remittances.distributorId, distId))
    .orderBy(desc(schema.remittances.createdAt))
    .limit(100);
  res.json(rows);
}));

remittancesRouter.get("/:id/allocations", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const remitId = Number(req.params.id);
  const rows = await db.select({
    id: schema.paymentAllocations.id,
    amount: schema.paymentAllocations.amount,
    saleId: schema.paymentAllocations.saleId,
    createdAt: schema.paymentAllocations.createdAt,
    bookTitle: schema.books.title,
    saleValue: schema.sales.totalValue,
  }).from(schema.paymentAllocations)
    .innerJoin(schema.sales, eq(schema.paymentAllocations.saleId, schema.sales.id))
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(eq(schema.paymentAllocations.remittanceId, remitId));
  res.json(rows);
}));

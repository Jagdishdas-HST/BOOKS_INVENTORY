
import { Router } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../db/client";
import { validateBody } from "../middleware/validate";
import { HttpError, asyncHandler } from "../lib/httpError";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { logAudit } from "../lib/audit";

export const remittancesRouter = Router();

const CreateRemit = z.object({
  amount: z.coerce.number().positive(),
  note: z.string().max(300).nullable().optional(),
});

remittancesRouter.post("/", requireAuth, validateBody(CreateRemit), asyncHandler(async (req: AuthedRequest, res) => {
  if (req.user!.role !== "distributor") throw new HttpError(403, "FORBIDDEN", "Only distributors log remittances");
  const { amount, note } = req.body;
  const [row] = await db.insert(schema.remittances).values({
    distributorId: req.user!.id, amount: String(amount), note: note ?? null,
  }).returning();
  await logAudit(req.user!.id, "remittance", "remittance", `₹${amount}${note ? ` — ${note}` : ""}`);
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

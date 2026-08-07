
import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "../db/client";
import { asyncHandler } from "../lib/httpError";
import { requireAuth, type AuthedRequest } from "../lib/auth";

export const notificationsRouter = Router();

// Role-aware in-app notification flags.
//   - Admin/Manager: low-stock books (at/below reorder threshold).
//   - Distributor: pending-remittance / high-debt flags. `?debtThreshold=`
//     is configurable (defaults to 5000).
notificationsRouter.get("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const isAdmin = req.user!.role === "super_admin" || req.user!.role === "inventory_manager";
  const notifications: { id: string; type: string; severity: "warning" | "danger" | "info"; title: string; body: string; entityId?: number }[] = [];

  if (isAdmin) {
    const all = await db.select().from(schema.books).where(eq(schema.books.active, true));
    const low = all.filter((b) => b.warehouseStock <= b.reorderThreshold);
    for (const b of low) {
      notifications.push({
        id: `lowstock-${b.id}`,
        type: "low_stock",
        severity: b.warehouseStock === 0 ? "danger" : "warning",
        title: b.warehouseStock === 0 ? "Out of stock" : "Low on stock",
        body: `${b.title} — ${b.warehouseStock} left (reorder ≤ ${b.reorderThreshold})`,
        entityId: b.id,
      });
    }
  } else {
    const distId = req.user!.id;
    const debtThreshold = Number(req.query.debtThreshold ?? 5000);

    const [debtRow] = await db.select({ total: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)` })
      .from(schema.sales)
      .where(and(eq(schema.sales.distributorId, distId), eq(schema.sales.paymentType, "debt")));
    const [remitRow] = await db.select({ total: sql<string>`COALESCE(SUM(${schema.remittances.amount}),0)` })
      .from(schema.remittances)
      .where(eq(schema.remittances.distributorId, distId));

    const outstanding = parseFloat(debtRow.total) - parseFloat(remitRow.total);

    if (outstanding >= debtThreshold) {
      notifications.push({
        id: "high-debt",
        type: "high_debt",
        severity: "danger",
        title: "Outstanding balance over limit",
        body: `Your balance is ₹${outstanding.toLocaleString("en-IN")}, above the ₹${debtThreshold.toLocaleString("en-IN")} limit. Please remit soon.`,
      });
    } else if (outstanding >= debtThreshold * 0.75 && outstanding > 0) {
      notifications.push({
        id: "pending-remittance",
        type: "pending_remittance",
        severity: "warning",
        title: "Remittance due soon",
        body: `Your balance is ₹${outstanding.toLocaleString("en-IN")}, approaching the ₹${debtThreshold.toLocaleString("en-IN")} limit.`,
      });
    }
  }

  res.json({ count: notifications.length, notifications });
}));

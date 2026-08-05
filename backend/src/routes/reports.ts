
import { Router } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "../db/client";
import { asyncHandler } from "../lib/httpError";
import { requireAuth, requireRole } from "../lib/auth";

export const reportsRouter = Router();

function rangeToFrom(range?: string): Date | undefined {
  const now = new Date();
  if (range === "today") { now.setHours(0, 0, 0, 0); return now; }
  if (range === "week") { now.setDate(now.getDate() - 7); return now; }
  if (range === "month") { now.setDate(now.getDate() - 30); return now; }
  return undefined;
}

// Admin + Manager only. Everything is filterable by ?range=today|week|month|all
reportsRouter.get("/", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : "all";
  const from = rangeToFrom(range);

  const salesWhere = from ? gte(schema.sales.createdAt, from) : undefined;

  // Overall summary
  const [summary] = await db.select({
    totalSalesValue: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)`,
    totalCopies: sql<string>`COALESCE(SUM(${schema.sales.quantity}),0)`,
    cashTotal: sql<string>`COALESCE(SUM(CASE WHEN ${schema.sales.paymentType}='cash' THEN ${schema.sales.totalValue} ELSE 0 END),0)`,
    onlineTotal: sql<string>`COALESCE(SUM(CASE WHEN ${schema.sales.paymentType}='online' THEN ${schema.sales.totalValue} ELSE 0 END),0)`,
    debtTotal: sql<string>`COALESCE(SUM(CASE WHEN ${schema.sales.paymentType}='debt' THEN ${schema.sales.totalValue} ELSE 0 END),0)`,
  }).from(schema.sales).where(salesWhere);

  // Total remitted (not range-scoped for outstanding accuracy)
  const [remitRow] = await db.select({ total: sql<string>`COALESCE(SUM(${schema.remittances.amount}),0)` })
    .from(schema.remittances);

  // Distributor leaderboard
  const leaderboard = await db.select({
    distributorId: schema.users.id,
    name: schema.users.name,
    copies: sql<string>`COALESCE(SUM(${schema.sales.quantity}),0)`,
    value: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)`,
  }).from(schema.sales)
    .innerJoin(schema.users, eq(schema.sales.distributorId, schema.users.id))
    .where(salesWhere)
    .groupBy(schema.users.id, schema.users.name)
    .orderBy(desc(sql`SUM(${schema.sales.totalValue})`))
    .limit(20);

  // Category breakdown
  const categories = await db.select({
    category: schema.books.category,
    copies: sql<string>`COALESCE(SUM(${schema.sales.quantity}),0)`,
    value: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)`,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(salesWhere)
    .groupBy(schema.books.category)
    .orderBy(desc(sql`SUM(${schema.sales.totalValue})`));

  // Top-selling titles
  const topBooks = await db.select({
    title: schema.books.title,
    sku: schema.books.sku,
    copies: sql<string>`COALESCE(SUM(${schema.sales.quantity}),0)`,
    value: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)`,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(salesWhere)
    .groupBy(schema.books.id, schema.books.title, schema.books.sku)
    .orderBy(desc(sql`SUM(${schema.sales.quantity})`))
    .limit(10);

  res.json({
    range,
    summary: {
      totalSalesValue: parseFloat(summary.totalSalesValue),
      totalCopies: parseInt(summary.totalCopies, 10),
      cashTotal: parseFloat(summary.cashTotal),
      onlineTotal: parseFloat(summary.onlineTotal),
      debtTotal: parseFloat(summary.debtTotal),
      remittedTotal: parseFloat(remitRow.total),
      outstanding: parseFloat(summary.debtTotal) - parseFloat(remitRow.total),
    },
    leaderboard: leaderboard.map((l) => ({
      distributorId: l.distributorId, name: l.name,
      copies: parseInt(l.copies, 10), value: parseFloat(l.value),
    })),
    categories: categories.map((c) => ({
      category: c.category, copies: parseInt(c.copies, 10), value: parseFloat(c.value),
    })),
    topBooks: topBooks.map((b) => ({
      title: b.title, sku: b.sku, copies: parseInt(b.copies, 10), value: parseFloat(b.value),
    })),
  });
}));


import { Router } from "express";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
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

// Build the shared WHERE for sales-based queries from the reporting filters:
//   range=today|week|month|all, from=YYYY-MM-DD, to=YYYY-MM-DD, distributorId, category
function buildSalesFilters(q: any): SQL[] {
  const conds: SQL[] = [];

  // Custom date range takes priority over range preset
  if (q.from && typeof q.from === "string") {
    const fromDate = new Date(q.from + "T00:00:00");
    if (!isNaN(fromDate.getTime())) conds.push(gte(schema.sales.createdAt, fromDate));
  } else {
    const from = rangeToFrom(typeof q.range === "string" ? q.range : "all");
    if (from) conds.push(gte(schema.sales.createdAt, from));
  }

  if (q.to && typeof q.to === "string") {
    const toDate = new Date(q.to + "T23:59:59");
    if (!isNaN(toDate.getTime())) conds.push(lte(schema.sales.createdAt, toDate));
  }

  if (q.distributorId && !Number.isNaN(Number(q.distributorId))) {
    conds.push(eq(schema.sales.distributorId, Number(q.distributorId)));
  }
  if (q.category && typeof q.category === "string" && q.category !== "all") {
    conds.push(eq(schema.books.category, q.category));
  }
  return conds;
}

// CSV helpers ---------------------------------------------------------------
function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsv(headers: string[], rows: (any[])[]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  return lines.join("\r\n");
}
function sendCsv(res: any, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + csv); // BOM for Excel
}

// Admin + Manager only. Everything is filterable by ?range, ?from, ?to, ?distributorId, ?category
reportsRouter.get("/", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : "all";
  const conds = buildSalesFilters(req.query);
  const salesWhere = conds.length ? and(...conds) : undefined;

  // Overall summary
  const [summary] = await db.select({
    totalSalesValue: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)`,
    totalCopies: sql<string>`COALESCE(SUM(${schema.sales.quantity}),0)`,
    cashTotal: sql<string>`COALESCE(SUM(CASE WHEN ${schema.sales.paymentType}='cash' THEN ${schema.sales.totalValue} ELSE 0 END),0)`,
    onlineTotal: sql<string>`COALESCE(SUM(CASE WHEN ${schema.sales.paymentType}='online' THEN ${schema.sales.totalValue} ELSE 0 END),0)`,
    debtTotal: sql<string>`COALESCE(SUM(CASE WHEN ${schema.sales.paymentType}='debt' THEN ${schema.sales.totalValue} ELSE 0 END),0)`,
    freeCopies: sql<string>`COALESCE(SUM(CASE WHEN ${schema.sales.paymentType}='free' THEN ${schema.sales.quantity} ELSE 0 END),0)`,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(salesWhere);

  const [remitRow] = await db.select({ total: sql<string>`COALESCE(SUM(${schema.remittances.amount}),0)` })
    .from(schema.remittances);

  // Distributor leaderboard (respects category + range filters)
  const leaderboard = await db.select({
    distributorId: schema.users.id,
    name: schema.users.name,
    copies: sql<string>`COALESCE(SUM(${schema.sales.quantity}),0)`,
    value: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)`,
  }).from(schema.sales)
    .innerJoin(schema.users, eq(schema.sales.distributorId, schema.users.id))
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
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
      freeCopies: parseInt(summary.freeCopies, 10),
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

// TREND CHARTS -------------------------------------------------------------
// ?bucket=day|week|month + the same range/distributor/category filters.
reportsRouter.get("/trends", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (req, res) => {
  const bucket = req.query.bucket === "week" ? "week" : req.query.bucket === "month" ? "month" : "day";
  const conds = buildSalesFilters(req.query);
  const salesWhere = conds.length ? and(...conds) : undefined;

  // Group + order on the SAME date_trunc expression that the SELECT uses.
  // Previously the SELECT wrapped date_trunc in to_char() while GROUP BY used
  // the to_char() form too, but Postgres still couldn't match the inner
  // sales.created_at reference — grouping on the bare date_trunc expression
  // (which references the column via an aggregate-safe grouping key) resolves
  // the "must appear in GROUP BY" error.
  const truncExpr = sql`date_trunc(${bucket}, ${schema.sales.createdAt})`;
  const periodExpr = sql<string>`to_char(date_trunc(${bucket}, ${schema.sales.createdAt}), 'YYYY-MM-DD')`;

  const rows = await db.select({
    period: periodExpr,
    value: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)`,
    copies: sql<string>`COALESCE(SUM(${schema.sales.quantity}),0)`,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(salesWhere)
    .groupBy(truncExpr)
    .orderBy(truncExpr);

  res.json({
    bucket,
    points: rows.map((r) => ({
      period: r.period,
      value: parseFloat(r.value),
      copies: parseInt(r.copies, 10),
    })),
  });
}));

// PROFIT MARGIN ------------------------------------------------------------
reportsRouter.get("/margin", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (req, res) => {
  const conds = buildSalesFilters(req.query);
  const salesWhere = conds.length ? and(...conds) : undefined;

  const revenueExpr = sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)`;
  const costExpr = sql<string>`COALESCE(SUM(${schema.sales.quantity} * ${schema.books.costPrice}),0)`;

  const [overall] = await db.select({
    revenue: revenueExpr, cost: costExpr,
    copies: sql<string>`COALESCE(SUM(${schema.sales.quantity}),0)`,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(salesWhere);

  const byBook = await db.select({
    title: schema.books.title, sku: schema.books.sku,
    revenue: revenueExpr, cost: costExpr,
    copies: sql<string>`COALESCE(SUM(${schema.sales.quantity}),0)`,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(salesWhere)
    .groupBy(schema.books.id, schema.books.title, schema.books.sku)
    .orderBy(desc(sql`SUM(${schema.sales.totalValue}) - SUM(${schema.sales.quantity} * ${schema.books.costPrice})`))
    .limit(20);

  const byCategory = await db.select({
    category: schema.books.category,
    revenue: revenueExpr, cost: costExpr,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(salesWhere)
    .groupBy(schema.books.category)
    .orderBy(desc(sql`SUM(${schema.sales.totalValue}) - SUM(${schema.sales.quantity} * ${schema.books.costPrice})`));

  const byDistributor = await db.select({
    distributorId: schema.users.id, name: schema.users.name,
    revenue: revenueExpr, cost: costExpr,
  }).from(schema.sales)
    .innerJoin(schema.users, eq(schema.sales.distributorId, schema.users.id))
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(salesWhere)
    .groupBy(schema.users.id, schema.users.name)
    .orderBy(desc(sql`SUM(${schema.sales.totalValue}) - SUM(${schema.sales.quantity} * ${schema.books.costPrice})`));

  const pack = (revStr: string, costStr: string) => {
    const revenue = parseFloat(revStr), cost = parseFloat(costStr);
    const margin = revenue - cost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    return { revenue, cost, margin, marginPct };
  };

  res.json({
    overall: { ...pack(overall.revenue, overall.cost), copies: parseInt(overall.copies, 10) },
    byBook: byBook.map((b) => ({ title: b.title, sku: b.sku, copies: parseInt(b.copies, 10), ...pack(b.revenue, b.cost) })),
    byCategory: byCategory.map((c) => ({ category: c.category, ...pack(c.revenue, c.cost) })),
    byDistributor: byDistributor.map((d) => ({ distributorId: d.distributorId, name: d.name, ...pack(d.revenue, d.cost) })),
  });
}));

// Distinct categories for the reporting filter chips.
reportsRouter.get("/categories", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (_req, res) => {
  const rows = await db.selectDistinct({ category: schema.books.category }).from(schema.books);
  res.json(rows.map((r) => r.category).sort());
}));

// EXPORTS ------------------------------------------------------------------
// All export routes accept ?token= (browser downloads can't set headers).

// Sales (filtered) CSV
reportsRouter.get("/export/sales.csv", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (req, res) => {
  const conds = buildSalesFilters(req.query);
  const salesWhere = conds.length ? and(...conds) : undefined;
  const rows = await db.select({
    id: schema.sales.id,
    createdAt: schema.sales.createdAt,
    distributor: schema.users.name,
    book: schema.books.title,
    sku: schema.books.sku,
    category: schema.books.category,
    quantity: schema.sales.quantity,
    unitPrice: schema.sales.unitPrice,
    retailPrice: schema.books.retailPrice,
    totalValue: schema.sales.totalValue,
    paymentType: schema.sales.paymentType,
    isDiscounted: schema.sales.isDiscounted,
  }).from(schema.sales)
    .innerJoin(schema.users, eq(schema.sales.distributorId, schema.users.id))
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(salesWhere)
    .orderBy(desc(schema.sales.createdAt));

  const csv = toCsv(
    ["ID", "Date", "Distributor", "Book", "SKU", "Category", "Qty", "Unit Price", "Retail", "Total", "Payment", "Discounted"],
    rows.map((r) => [
      r.id, new Date(r.createdAt).toISOString(), r.distributor, r.book, r.sku, r.category,
      r.quantity, r.unitPrice, r.retailPrice, r.totalValue, r.paymentType, r.isDiscounted ? "yes" : "no",
    ]),
  );
  sendCsv(res, "sales.csv", csv);
}));

// Remittances CSV (optionally by distributor)
reportsRouter.get("/export/remittances.csv", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (req, res) => {
  const conds: SQL[] = [];
  if (req.query.distributorId && !Number.isNaN(Number(req.query.distributorId))) {
    conds.push(eq(schema.remittances.distributorId, Number(req.query.distributorId)));
  }
  const rows = await db.select({
    id: schema.remittances.id,
    createdAt: schema.remittances.createdAt,
    distributor: schema.users.name,
    amount: schema.remittances.amount,
    note: schema.remittances.note,
  }).from(schema.remittances)
    .innerJoin(schema.users, eq(schema.remittances.distributorId, schema.users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.remittances.createdAt));

  const csv = toCsv(
    ["ID", "Date", "Distributor", "Amount", "Note"],
    rows.map((r) => [r.id, new Date(r.createdAt).toISOString(), r.distributor, r.amount, r.note ?? ""]),
  );
  sendCsv(res, "remittances.csv", csv);
}));

// Stock movements CSV
reportsRouter.get("/export/stock.csv", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (_req, res) => {
  const rows = await db.select({
    id: schema.stockMovements.id,
    createdAt: schema.stockMovements.createdAt,
    book: schema.books.title,
    distributor: schema.users.name,
    type: schema.stockMovements.type,
    quantity: schema.stockMovements.quantity,
    reason: schema.stockMovements.reason,
  }).from(schema.stockMovements)
    .innerJoin(schema.books, eq(schema.stockMovements.bookId, schema.books.id))
    .leftJoin(schema.users, eq(schema.stockMovements.distributorId, schema.users.id))
    .orderBy(desc(schema.stockMovements.createdAt));

  const csv = toCsv(
    ["ID", "Date", "Book", "Distributor", "Type", "Qty", "Reason"],
    rows.map((r) => [r.id, new Date(r.createdAt).toISOString(), r.book, r.distributor ?? "", r.type, r.quantity, r.reason ?? ""]),
  );
  sendCsv(res, "stock-movements.csv", csv);
}));

// Audit log CSV (Super Admin only)
reportsRouter.get("/export/audit.csv", requireAuth, requireRole("super_admin"), asyncHandler(async (req, res) => {
  const conds: SQL[] = [];
  if (typeof req.query.action === "string" && req.query.action !== "all") conds.push(eq(schema.auditLog.action, req.query.action));
  if (typeof req.query.from === "string") conds.push(gte(schema.auditLog.createdAt, new Date(req.query.from)));
  if (typeof req.query.to === "string") conds.push(lte(schema.auditLog.createdAt, new Date(req.query.to)));

  const rows = await db.select({
    id: schema.auditLog.id,
    createdAt: schema.auditLog.createdAt,
    user: schema.users.name,
    role: schema.users.role,
    action: schema.auditLog.action,
    entity: schema.auditLog.entity,
    details: schema.auditLog.details,
  }).from(schema.auditLog)
    .innerJoin(schema.users, eq(schema.auditLog.userId, schema.users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(1000);

  const csv = toCsv(
    ["ID", "Date", "User", "Role", "Action", "Entity", "Details"],
    rows.map((r) => [r.id, new Date(r.createdAt).toISOString(), r.user, r.role, r.action, r.entity, r.details ?? ""]),
  );
  sendCsv(res, "audit-log.csv", csv);
}));

// Profit margin (per-book) CSV
reportsRouter.get("/export/margin.csv", requireAuth, requireRole("super_admin", "inventory_manager"), asyncHandler(async (req, res) => {
  const conds = buildSalesFilters(req.query);
  const salesWhere = conds.length ? and(...conds) : undefined;
  const revenueExpr = sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)`;
  const costExpr = sql<string>`COALESCE(SUM(${schema.sales.quantity} * ${schema.books.costPrice}),0)`;

  const rows = await db.select({
    title: schema.books.title, sku: schema.books.sku, category: schema.books.category,
    copies: sql<string>`COALESCE(SUM(${schema.sales.quantity}),0)`,
    revenue: revenueExpr, cost: costExpr,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(salesWhere)
    .groupBy(schema.books.id, schema.books.title, schema.books.sku, schema.books.category)
    .orderBy(desc(sql`SUM(${schema.sales.totalValue}) - SUM(${schema.sales.quantity} * ${schema.books.costPrice})`));

  const csv = toCsv(
    ["Book", "SKU", "Category", "Copies", "Revenue", "Cost", "Margin", "Margin %"],
    rows.map((r) => {
      const revenue = parseFloat(r.revenue), cost = parseFloat(r.cost);
      const margin = revenue - cost;
      const pct = revenue > 0 ? ((margin / revenue) * 100).toFixed(1) : "0.0";
      return [r.title, r.sku, r.category, r.copies, revenue.toFixed(2), cost.toFixed(2), margin.toFixed(2), pct];
    }),
  );
  sendCsv(res, "profit-margin.csv", csv);
}));

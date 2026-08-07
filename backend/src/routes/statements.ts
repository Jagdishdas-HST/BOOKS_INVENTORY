
import { Router } from "express";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "../db/client";
import { HttpError, asyncHandler } from "../lib/httpError";
import { requireAuth, type AuthedRequest } from "../lib/auth";

export const statementsRouter = Router();

// Build the statement payload for a distributor over [from, to).
async function buildStatement(distId: number, from: Date, to: Date) {
  const [dist] = await db.select().from(schema.users).where(eq(schema.users.id, distId));
  if (!dist) throw new HttpError(404, "NOT_FOUND", "Distributor not found");

  // Opening outstanding = debt sales before `from` minus remittances before `from`.
  const [openDebt] = await db.select({ total: sql<string>`COALESCE(SUM(${schema.sales.totalValue}),0)` })
    .from(schema.sales)
    .where(and(eq(schema.sales.distributorId, distId), eq(schema.sales.paymentType, "debt"), lt(schema.sales.createdAt, from)));
  const [openRemit] = await db.select({ total: sql<string>`COALESCE(SUM(${schema.remittances.amount}),0)` })
    .from(schema.remittances)
    .where(and(eq(schema.remittances.distributorId, distId), lt(schema.remittances.createdAt, from)));
  const openingOutstanding = parseFloat(openDebt.total) - parseFloat(openRemit.total);

  // Sales in range broken out by payment type.
  const rangeSalesWhere = and(
    eq(schema.sales.distributorId, distId),
    gte(schema.sales.createdAt, from),
    lt(schema.sales.createdAt, to),
  );
  const sales = await db.select({
    id: schema.sales.id,
    quantity: schema.sales.quantity,
    unitPrice: schema.sales.unitPrice,
    totalValue: schema.sales.totalValue,
    paymentType: schema.sales.paymentType,
    isDiscounted: schema.sales.isDiscounted,
    createdAt: schema.sales.createdAt,
    bookTitle: schema.books.title,
    sku: schema.books.sku,
  }).from(schema.sales)
    .innerJoin(schema.books, eq(schema.sales.bookId, schema.books.id))
    .where(rangeSalesWhere)
    .orderBy(asc(schema.sales.createdAt));

  const byType: Record<string, { copies: number; value: number }> = {
    cash: { copies: 0, value: 0 }, online: { copies: 0, value: 0 },
    debt: { copies: 0, value: 0 }, free: { copies: 0, value: 0 },
  };
  let discountedValue = 0;
  for (const s of sales) {
    const v = parseFloat(s.totalValue);
    byType[s.paymentType].copies += s.quantity;
    byType[s.paymentType].value += v;
    if (s.isDiscounted) discountedValue += v;
  }

  // Remittances in range.
  const remittances = await db.select().from(schema.remittances)
    .where(and(eq(schema.remittances.distributorId, distId), gte(schema.remittances.createdAt, from), lt(schema.remittances.createdAt, to)))
    .orderBy(asc(schema.remittances.createdAt));
  const remitTotal = remittances.reduce((a, r) => a + parseFloat(r.amount), 0);

  // Closing outstanding = opening + debt-in-range - remittances-in-range.
  const closingOutstanding = openingOutstanding + byType.debt.value - remitTotal;

  return {
    distributor: { id: dist.id, name: dist.name, username: dist.username },
    from: from.toISOString(),
    to: to.toISOString(),
    openingOutstanding,
    closingOutstanding,
    byType,
    discountedValue,
    remitTotal,
    sales: sales.map((s) => ({
      id: s.id, bookTitle: s.bookTitle, sku: s.sku, quantity: s.quantity,
      unitPrice: parseFloat(s.unitPrice), totalValue: parseFloat(s.totalValue),
      paymentType: s.paymentType, isDiscounted: s.isDiscounted, createdAt: s.createdAt,
    })),
    remittances: remittances.map((r) => ({
      id: r.id, amount: parseFloat(r.amount), note: r.note, createdAt: r.createdAt,
    })),
  };
}

function resolveDistId(req: AuthedRequest): number {
  if (req.user!.role === "distributor") return req.user!.id;
  const q = req.query.distributorId;
  if (!q) throw new HttpError(400, "BAD_REQUEST", "distributorId is required");
  return Number(q);
}

function resolveRange(req: AuthedRequest): { from: Date; to: Date } {
  const fromStr = typeof req.query.from === "string" ? req.query.from : undefined;
  const toStr = typeof req.query.to === "string" ? req.query.to : undefined;
  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 86400000);
  const to = toStr ? new Date(toStr) : new Date();
  // Make `to` inclusive of the whole selected day.
  to.setHours(23, 59, 59, 999);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

// JSON statement (used to render the on-screen preview).
statementsRouter.get("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const distId = resolveDistId(req);
  const { from, to } = resolveRange(req);
  res.json(await buildStatement(distId, from, to));
}));

// CSV export.
statementsRouter.get("/csv", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const distId = resolveDistId(req);
  const { from, to } = resolveRange(req);
  const st = await buildStatement(distId, from, to);

  const lines: string[] = [];
  lines.push(`Statement for,${st.distributor.name}`);
  lines.push(`Period,${st.from.slice(0, 10)} to ${st.to.slice(0, 10)}`);
  lines.push(`Opening outstanding,${st.openingOutstanding.toFixed(2)}`);
  lines.push(`Closing outstanding,${st.closingOutstanding.toFixed(2)}`);
  lines.push("");
  lines.push("Sales");
  lines.push("Date,Book,SKU,Qty,Unit Price,Total,Payment,Discounted");
  for (const s of st.sales) {
    lines.push([
      new Date(s.createdAt).toISOString().slice(0, 10),
      `"${s.bookTitle.replace(/"/g, '""')}"`, s.sku, s.quantity,
      s.unitPrice.toFixed(2), s.totalValue.toFixed(2), s.paymentType, s.isDiscounted ? "Yes" : "No",
    ].join(","));
  }
  lines.push("");
  lines.push("Remittances");
  lines.push("Date,Amount,Note");
  for (const r of st.remittances) {
    lines.push([new Date(r.createdAt).toISOString().slice(0, 10), r.amount.toFixed(2), `"${(r.note || "").replace(/"/g, '""')}"`].join(","));
  }

  const csv = lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="statement-${st.distributor.username}.csv"`);
  res.send(csv);
}));

// PDF export — generated as a minimal self-contained PDF (no external deps).
statementsRouter.get("/pdf", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const distId = resolveDistId(req);
  const { from, to } = resolveRange(req);
  const st = await buildStatement(distId, from, to);

  const inr = (n: number) => `Rs ${n.toLocaleString("en-IN")}`;
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const body: string[] = [];
  body.push(`Statement — ${st.distributor.name}`);
  body.push(`Period: ${st.from.slice(0, 10)} to ${st.to.slice(0, 10)}`);
  body.push("");
  body.push(`Opening outstanding: ${inr(st.openingOutstanding)}`);
  body.push(`Closing outstanding: ${inr(st.closingOutstanding)}`);
  body.push("");
  body.push(`Cash: ${inr(st.byType.cash.value)}  (${st.byType.cash.copies} copies)`);
  body.push(`Online: ${inr(st.byType.online.value)}  (${st.byType.online.copies} copies)`);
  body.push(`Debt: ${inr(st.byType.debt.value)}  (${st.byType.debt.copies} copies)`);
  body.push(`Free: ${st.byType.free.copies} copies (Rs 0)`);
  body.push(`Discounted sales value: ${inr(st.discountedValue)}`);
  body.push(`Remittances in period: ${inr(st.remitTotal)}`);
  body.push("");
  body.push(`Sales lines: ${st.sales.length}`);
  st.sales.slice(0, 30).forEach((s) => {
    body.push(`  ${new Date(s.createdAt).toISOString().slice(0, 10)}  ${s.bookTitle}  x${s.quantity}  ${inr(s.totalValue)}  ${s.paymentType}${s.isDiscounted ? " (disc)" : ""}`);
  });

  let text = "BT /F1 11 Tf 50 780 Td 14 TL\n";
  for (const line of body) {
    text += `(${esc(line)}) Tj T*\n`;
  }
  text += "ET";

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>");
  objects.push(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="statement-${st.distributor.username}.pdf"`);
  res.send(Buffer.from(pdf, "latin1"));
}));

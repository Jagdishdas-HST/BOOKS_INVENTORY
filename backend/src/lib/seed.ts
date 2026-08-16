
import { db, schema } from "../db/client";
import { hashPassword } from "./auth";
import { eq, sql } from "drizzle-orm";

export async function seedIfEmpty() {
  const existing = await db.select().from(schema.users).limit(1);
  if (existing.length > 0) return;

  // ── Users ────────────────────────────────────────────────────────────────
  const [admin] = await db.insert(schema.users).values({
    name: "Gopal Das",
    username: "admin",
    passwordHash: hashPassword("admin123"),
    role: "super_admin",
  }).returning();

  const [manager] = await db.insert(schema.users).values({
    name: "Radha Priya",
    username: "manager",
    passwordHash: hashPassword("manager123"),
    role: "inventory_manager",
  }).returning();

  const [dist1] = await db.insert(schema.users).values({
    name: "Nitai Chand",
    username: "nitai",
    passwordHash: hashPassword("nitai123"),
    role: "distributor",
  }).returning();

  const [dist2] = await db.insert(schema.users).values({
    name: "Vraja Kishor",
    username: "vraja",
    passwordHash: hashPassword("vraja123"),
    role: "distributor",
  }).returning();

  const [dist3] = await db.insert(schema.users).values({
    name: "Madhava Dasa",
    username: "madhava",
    passwordHash: hashPassword("madhava123"),
    role: "distributor",
  }).returning();

  // ── Books ─────────────────────────────────────────────────────────────────
  const bookRows = await db.insert(schema.books).values([
    {
      sku: "BG-EN-001",
      title: "Bhagavad-gita As It Is",
      category: "Bhagavad-gita",
      language: "English",
      costPrice: "120.00",
      retailPrice: "350.00",
      warehouseStock: 180,
      reorderThreshold: 30,
      isbn: "978-0892131228",
    },
    {
      sku: "BG-HI-001",
      title: "Bhagavad-gita As It Is (Hindi)",
      category: "Bhagavad-gita",
      language: "Hindi",
      costPrice: "110.00",
      retailPrice: "300.00",
      warehouseStock: 130,
      reorderThreshold: 25,
      isbn: "978-0892131235",
    },
    {
      sku: "SB-EN-01",
      title: "Srimad-Bhagavatam Canto 1",
      category: "Srimad-Bhagavatam",
      language: "English",
      costPrice: "180.00",
      retailPrice: "500.00",
      warehouseStock: 60,
      reorderThreshold: 15,
      isbn: "978-0892131242",
    },
    {
      sku: "NOD-EN-01",
      title: "Nectar of Devotion",
      category: "Nectar of Devotion",
      language: "English",
      costPrice: "90.00",
      retailPrice: "250.00",
      warehouseStock: 95,
      reorderThreshold: 20,
      isbn: "978-0892131259",
    },
    {
      sku: "SSR-EN-01",
      title: "Science of Self-Realization",
      category: "Small Books",
      language: "English",
      costPrice: "40.00",
      retailPrice: "120.00",
      warehouseStock: 280,
      reorderThreshold: 50,
      isbn: "978-0892131266",
    },
    {
      sku: "MAG-BTG-01",
      title: "Back to Godhead Magazine",
      category: "Magazines",
      language: "English",
      costPrice: "25.00",
      retailPrice: "60.00",
      warehouseStock: 450,
      reorderThreshold: 80,
    },
    {
      sku: "KB-EN-01",
      title: "Krsna Book",
      category: "Krsna Book",
      language: "English",
      costPrice: "150.00",
      retailPrice: "420.00",
      warehouseStock: 70,
      reorderThreshold: 15,
      isbn: "978-0892131273",
    },
    {
      sku: "NOI-EN-01",
      title: "Nectar of Instruction",
      category: "Small Books",
      language: "English",
      costPrice: "35.00",
      retailPrice: "100.00",
      warehouseStock: 200,
      reorderThreshold: 40,
      isbn: "978-0892131280",
    },
    {
      sku: "TLC-EN-01",
      title: "Teachings of Lord Caitanya",
      category: "Teachings",
      language: "English",
      costPrice: "95.00",
      retailPrice: "280.00",
      warehouseStock: 55,
      reorderThreshold: 12,
      isbn: "978-0892131297",
    },
    {
      sku: "BG-BN-001",
      title: "Bhagavad-gita As It Is (Bengali)",
      category: "Bhagavad-gita",
      language: "Bengali",
      costPrice: "105.00",
      retailPrice: "290.00",
      warehouseStock: 18,
      reorderThreshold: 20,
    },
  ]).returning();

  const bg = bookRows[0];
  const bgHi = bookRows[1];
  const sb = bookRows[2];
  const nod = bookRows[3];
  const ssr = bookRows[4];
  const mag = bookRows[5];
  const kb = bookRows[6];
  const noi = bookRows[7];
  const tlc = bookRows[8];
  const bgBn = bookRows[9];

  // ── Audit helper (inline for seed) ─────────────────────────────────────────
  async function audit(
    userId: number,
    action: string,
    entity: string,
    details: string,
    createdAt?: Date,
  ) {
    await db.insert(schema.auditLog).values({
      userId,
      action,
      entity,
      details,
      createdAt: createdAt ?? new Date(),
    });
  }

  // ── Audit: user creation ────────────────────────────────────────────────────
  const now = new Date();
  const d = (daysAgo: number, hour = 10, min = 0) => {
    const t = new Date(now);
    t.setDate(t.getDate() - daysAgo);
    t.setHours(hour, min, 0, 0);
    return t;
  };

  await audit(admin.id, "create", "user", `Created super_admin "Gopal Das" (ID: ${admin.id})`, d(60));
  await audit(admin.id, "create", "user", `Created inventory_manager "Radha Priya" (ID: ${manager.id})`, d(60));
  await audit(admin.id, "create", "user", `Created distributor "Nitai Chand" (ID: ${dist1.id})`, d(58));
  await audit(admin.id, "create", "user", `Created distributor "Vraja Kishor" (ID: ${dist2.id})`, d(55));
  await audit(admin.id, "create", "user", `Created distributor "Madhava Dasa" (ID: ${dist3.id})`, d(50));

  // ── Audit: book creation ──────────────────────────────────────────────────
  for (const b of bookRows) {
    await audit(manager.id, "create", "book", `Added book "${b.title}" (SKU: ${b.sku}, ID: ${b.id})`, d(55));
  }

  // ── Price history ──────────────────────────────────────────────────────────
  await db.insert(schema.priceHistory).values([
    { bookId: bg.id, field: "retail_price", oldValue: "320.00", newValue: "350.00", changedById: admin.id, createdAt: d(45) },
    { bookId: nod.id, field: "retail_price", oldValue: "220.00", newValue: "250.00", changedById: admin.id, createdAt: d(30) },
    { bookId: mag.id, field: "cost_price", oldValue: "20.00", newValue: "25.00", changedById: manager.id, createdAt: d(20) },
    { bookId: ssr.id, field: "retail_price", oldValue: "100.00", newValue: "120.00", changedById: admin.id, createdAt: d(15) },
  ]);

  await audit(admin.id, "price_change", "book", `"Bhagavad-gita As It Is" (ID: ${bg.id}): retail ₹320 → ₹350`, d(45));
  await audit(admin.id, "price_change", "book", `"Nectar of Devotion" (ID: ${nod.id}): retail ₹220 → ₹250`, d(30));
  await audit(manager.id, "price_change", "book", `"Back to Godhead Magazine" (ID: ${mag.id}): cost ₹20 → ₹25`, d(20));
  await audit(admin.id, "price_change", "book", `"Science of Self-Realization" (ID: ${ssr.id}): retail ₹100 → ₹120`, d(15));

  // ── Stock assignments: dist1 (Nitai Chand) ─────────────────────────────────
  const dist1Stock = [
    { bookId: bg.id, quantity: 50 },
    { bookId: bgHi.id, quantity: 30 },
    { bookId: nod.id, quantity: 40 },
    { bookId: ssr.id, quantity: 60 },
    { bookId: mag.id, quantity: 80 },
    { bookId: noi.id, quantity: 35 },
  ];

  for (const s of dist1Stock) {
    await db.insert(schema.distributorStock).values({ distributorId: dist1.id, bookId: s.bookId, quantity: s.quantity });
    // Decrement warehouse stock by the assigned quantity using a proper SQL expression.
    await db.update(schema.books)
      .set({ warehouseStock: sql`${schema.books.warehouseStock} - ${s.quantity}` })
      .where(eq(schema.books.id, s.bookId));
    await db.insert(schema.stockMovements).values({
      bookId: s.bookId, distributorId: dist1.id, quantity: s.quantity,
      type: "assign", movedById: manager.id, createdAt: d(50),
    });
    const book = bookRows.find(b => b.id === s.bookId)!;
    await audit(manager.id, "assign", "stock", `+${s.quantity}x "${book.title}" (ID: ${book.id}) → Nitai Chand (ID: ${dist1.id})`, d(50));
  }

  // ── Stock assignments: dist2 (Vraja Kishor) ─────────────────────────────────
  const dist2Stock = [
    { bookId: bg.id, quantity: 40 },
    { bookId: sb.id, quantity: 20 },
    { bookId: kb.id, quantity: 25 },
    { bookId: mag.id, quantity: 60 },
    { bookId: tlc.id, quantity: 15 },
  ];

  for (const s of dist2Stock) {
    await db.insert(schema.distributorStock).values({ distributorId: dist2.id, bookId: s.bookId, quantity: s.quantity });
    await db.update(schema.books)
      .set({ warehouseStock: sql`${schema.books.warehouseStock} - ${s.quantity}` })
      .where(eq(schema.books.id, s.bookId));
    await db.insert(schema.stockMovements).values({
      bookId: s.bookId, distributorId: dist2.id, quantity: s.quantity,
      type: "assign", movedById: manager.id, createdAt: d(48),
    });
    const book = bookRows.find(b => b.id === s.bookId)!;
    await audit(manager.id, "assign", "stock", `+${s.quantity}x "${book.title}" (ID: ${book.id}) → Vraja Kishor (ID: ${dist2.id})`, d(48));
  }

  // ── Stock assignments: dist3 (Madhava Dasa) ─────────────────────────────────
  const dist3Stock = [
    { bookId: bgHi.id, quantity: 25 },
    { bookId: bgBn.id, quantity: 20 },
    { bookId: ssr.id, quantity: 45 },
    { bookId: noi.id, quantity: 30 },
    { bookId: mag.id, quantity: 50 },
  ];

  for (const s of dist3Stock) {
    await db.insert(schema.distributorStock).values({ distributorId: dist3.id, bookId: s.bookId, quantity: s.quantity });
    await db.update(schema.books)
      .set({ warehouseStock: sql`${schema.books.warehouseStock} - ${s.quantity}` })
      .where(eq(schema.books.id, s.bookId));
    await db.insert(schema.stockMovements).values({
      bookId: s.bookId, distributorId: dist3.id, quantity: s.quantity,
      type: "assign", movedById: admin.id, createdAt: d(45),
    });
    const book = bookRows.find(b => b.id === s.bookId)!;
    await audit(admin.id, "assign", "stock", `+${s.quantity}x "${book.title}" (ID: ${book.id}) → Madhava Dasa (ID: ${dist3.id})`, d(45));
  }

  // ── Stock intake (warehouse replenishment) ──────────────────────────────────
  const intakes = [
    { bookId: bg.id, quantity: 100, ref: "PO-2024-001", daysAgo: 40 },
    { bookId: ssr.id, quantity: 200, ref: "PO-2024-002", daysAgo: 35 },
    { bookId: mag.id, quantity: 300, ref: "PO-2024-003", daysAgo: 28 },
    { bookId: nod.id, quantity: 80, ref: "PO-2024-004", daysAgo: 20 },
    { bookId: bgBn.id, quantity: 50, ref: "PO-2024-005", daysAgo: 10 },
  ];

  for (const intake of intakes) {
    await db.insert(schema.stockMovements).values({
      bookId: intake.bookId, distributorId: null, quantity: intake.quantity,
      type: "stock_in", reason: intake.ref, movedById: manager.id, createdAt: d(intake.daysAgo),
    });
    const book = bookRows.find(b => b.id === intake.bookId)!;
    await audit(manager.id, "stock_in", "stock", `+${intake.quantity}x "${book.title}" (ID: ${book.id}) received (ref: ${intake.ref})`, d(intake.daysAgo));
  }

  // ── Sales: dist1 (Nitai Chand) ──────────────────────────────────────────────
  const dist1Sales = [
    { bookId: bg.id, qty: 5, price: "350.00", type: "cash" as const, daysAgo: 44, hour: 10 },
    { bookId: nod.id, qty: 3, price: "250.00", type: "cash" as const, daysAgo: 42, hour: 11 },
    { bookId: mag.id, qty: 10, price: "60.00", type: "cash" as const, daysAgo: 40, hour: 9 },
    { bookId: ssr.id, qty: 8, price: "120.00", type: "online" as const, daysAgo: 38, hour: 14 },
    { bookId: bg.id, qty: 4, price: "350.00", type: "debt" as const, daysAgo: 35, hour: 10 },
    { bookId: bgHi.id, qty: 6, price: "300.00", type: "cash" as const, daysAgo: 32, hour: 11 },
    { bookId: noi.id, qty: 5, price: "100.00", type: "online" as const, daysAgo: 30, hour: 15 },
    { bookId: mag.id, qty: 15, price: "60.00", type: "cash" as const, daysAgo: 28, hour: 9 },
    { bookId: nod.id, qty: 4, price: "250.00", type: "debt" as const, daysAgo: 25, hour: 12 },
    { bookId: ssr.id, qty: 10, price: "120.00", type: "cash" as const, daysAgo: 22, hour: 10 },
    { bookId: bg.id, qty: 3, price: "350.00", type: "online" as const, daysAgo: 20, hour: 14 },
    { bookId: bgHi.id, qty: 5, price: "300.00", type: "cash" as const, daysAgo: 18, hour: 11 },
    { bookId: noi.id, qty: 8, price: "100.00", type: "cash" as const, daysAgo: 15, hour: 10 },
    { bookId: mag.id, qty: 20, price: "60.00", type: "online" as const, daysAgo: 12, hour: 9 },
    { bookId: nod.id, qty: 2, price: "250.00", type: "free" as const, daysAgo: 10, hour: 16 },
    { bookId: bg.id, qty: 6, price: "350.00", type: "cash" as const, daysAgo: 8, hour: 10 },
    { bookId: ssr.id, qty: 12, price: "120.00", type: "debt" as const, daysAgo: 6, hour: 11 },
    { bookId: mag.id, qty: 8, price: "60.00", type: "cash" as const, daysAgo: 4, hour: 9 },
    { bookId: bgHi.id, qty: 4, price: "300.00", type: "online" as const, daysAgo: 2, hour: 14 },
    { bookId: nod.id, qty: 3, price: "250.00", type: "cash" as const, daysAgo: 1, hour: 10 },
  ];

  for (const s of dist1Sales) {
    const total = (s.qty * parseFloat(s.price)).toFixed(2);
    const isFree = s.type === "free";
    const actualPrice = isFree ? "0.00" : s.price;
    const actualTotal = isFree ? "0.00" : total;
    const saleDate = d(s.daysAgo, s.hour);
    const [saleRow] = await db.insert(schema.sales).values({
      distributorId: dist1.id, bookId: s.bookId, quantity: s.qty,
      unitPrice: actualPrice, totalValue: actualTotal,
      paymentType: s.type, isDiscounted: false,
      clientLoggedAt: saleDate, createdAt: saleDate,
    }).returning();
    const book = bookRows.find(b => b.id === s.bookId)!;
    const tag = isFree ? "FREE" : s.type;
    await audit(dist1.id, "sale", "sale", `Sale #${saleRow.id}: ${s.qty}x "${book.title}" (ID: ${book.id}) [${tag}] ₹${actualTotal} — by Nitai Chand (ID: ${dist1.id})`, saleDate);
  }

  // ── Sales: dist2 (Vraja Kishor) ─────────────────────────────────────────────
  const dist2Sales = [
    { bookId: bg.id, qty: 8, price: "350.00", type: "cash" as const, daysAgo: 43, hour: 10 },
    { bookId: sb.id, qty: 3, price: "500.00", type: "online" as const, daysAgo: 40, hour: 11 },
    { bookId: kb.id, qty: 5, price: "420.00", type: "cash" as const, daysAgo: 37, hour: 9 },
    { bookId: mag.id, qty: 20, price: "60.00", type: "cash" as const, daysAgo: 34, hour: 14 },
    { bookId: bg.id, qty: 6, price: "350.00", type: "debt" as const, daysAgo: 31, hour: 10 },
    { bookId: tlc.id, qty: 4, price: "280.00", type: "online" as const, daysAgo: 28, hour: 11 },
    { bookId: sb.id, qty: 2, price: "500.00", type: "cash" as const, daysAgo: 25, hour: 15 },
    { bookId: mag.id, qty: 25, price: "60.00", type: "cash" as const, daysAgo: 22, hour: 9 },
    { bookId: kb.id, qty: 3, price: "420.00", type: "debt" as const, daysAgo: 19, hour: 12 },
    { bookId: bg.id, qty: 5, price: "350.00", type: "cash" as const, daysAgo: 16, hour: 10 },
    { bookId: tlc.id, qty: 2, price: "280.00", type: "free" as const, daysAgo: 13, hour: 14 },
    { bookId: mag.id, qty: 18, price: "60.00", type: "online" as const, daysAgo: 10, hour: 11 },
    { bookId: sb.id, qty: 4, price: "500.00", type: "cash" as const, daysAgo: 7, hour: 10 },
    { bookId: bg.id, qty: 7, price: "350.00", type: "cash" as const, daysAgo: 4, hour: 9 },
    { bookId: kb.id, qty: 4, price: "420.00", type: "online" as const, daysAgo: 2, hour: 14 },
  ];

  for (const s of dist2Sales) {
    const isFree = s.type === "free";
    const actualPrice = isFree ? "0.00" : s.price;
    const actualTotal = isFree ? "0.00" : (s.qty * parseFloat(s.price)).toFixed(2);
    const saleDate = d(s.daysAgo, s.hour);
    const [saleRow] = await db.insert(schema.sales).values({
      distributorId: dist2.id, bookId: s.bookId, quantity: s.qty,
      unitPrice: actualPrice, totalValue: actualTotal,
      paymentType: s.type, isDiscounted: false,
      clientLoggedAt: saleDate, createdAt: saleDate,
    }).returning();
    const book = bookRows.find(b => b.id === s.bookId)!;
    const tag = isFree ? "FREE" : s.type;
    await audit(dist2.id, "sale", "sale", `Sale #${saleRow.id}: ${s.qty}x "${book.title}" (ID: ${book.id}) [${tag}] ₹${actualTotal} — by Vraja Kishor (ID: ${dist2.id})`, saleDate);
  }

  // ── Sales: dist3 (Madhava Dasa) ─────────────────────────────────────────────
  const dist3Sales = [
    { bookId: bgHi.id, qty: 6, price: "300.00", type: "cash" as const, daysAgo: 42, hour: 10 },
    { bookId: bgBn.id, qty: 4, price: "290.00", type: "cash" as const, daysAgo: 38, hour: 11 },
    { bookId: ssr.id, qty: 12, price: "120.00", type: "online" as const, daysAgo: 34, hour: 9 },
    { bookId: noi.id, qty: 8, price: "100.00", type: "cash" as const, daysAgo: 30, hour: 14 },
    { bookId: mag.id, qty: 15, price: "60.00", type: "debt" as const, daysAgo: 26, hour: 10 },
    { bookId: bgHi.id, qty: 5, price: "300.00", type: "online" as const, daysAgo: 22, hour: 11 },
    { bookId: ssr.id, qty: 10, price: "120.00", type: "cash" as const, daysAgo: 18, hour: 15 },
    { bookId: bgBn.id, qty: 3, price: "290.00", type: "free" as const, daysAgo: 14, hour: 9 },
    { bookId: noi.id, qty: 6, price: "100.00", type: "cash" as const, daysAgo: 10, hour: 12 },
    { bookId: mag.id, qty: 20, price: "60.00", type: "cash" as const, daysAgo: 6, hour: 10 },
    { bookId: bgHi.id, qty: 4, price: "300.00", type: "debt" as const, daysAgo: 3, hour: 14 },
    { bookId: ssr.id, qty: 8, price: "120.00", type: "online" as const, daysAgo: 1, hour: 11 },
  ];

  for (const s of dist3Sales) {
    const isFree = s.type === "free";
    const actualPrice = isFree ? "0.00" : s.price;
    const actualTotal = isFree ? "0.00" : (s.qty * parseFloat(s.price)).toFixed(2);
    const saleDate = d(s.daysAgo, s.hour);
    const [saleRow] = await db.insert(schema.sales).values({
      distributorId: dist3.id, bookId: s.bookId, quantity: s.qty,
      unitPrice: actualPrice, totalValue: actualTotal,
      paymentType: s.type, isDiscounted: false,
      clientLoggedAt: saleDate, createdAt: saleDate,
    }).returning();
    const book = bookRows.find(b => b.id === s.bookId)!;
    const tag = isFree ? "FREE" : s.type;
    await audit(dist3.id, "sale", "sale", `Sale #${saleRow.id}: ${s.qty}x "${book.title}" (ID: ${book.id}) [${tag}] ₹${actualTotal} — by Madhava Dasa (ID: ${dist3.id})`, saleDate);
  }

  // ── Remittances ─────────────────────────────────────────────────────────────
  const remittances = [
    { distId: dist1.id, distName: "Nitai Chand", amount: "3500.00", note: "Weekly collection - cash", daysAgo: 35 },
    { distId: dist1.id, distName: "Nitai Chand", amount: "2800.00", note: "Online transfer NEFT", daysAgo: 25 },
    { distId: dist1.id, distName: "Nitai Chand", amount: "4200.00", note: "Monthly settlement", daysAgo: 12 },
    { distId: dist2.id, distName: "Vraja Kishor", amount: "5600.00", note: "Bulk cash deposit", daysAgo: 30 },
    { distId: dist2.id, distName: "Vraja Kishor", amount: "3200.00", note: "UPI transfer", daysAgo: 18 },
    { distId: dist2.id, distName: "Vraja Kishor", amount: "4800.00", note: "Monthly settlement", daysAgo: 8 },
    { distId: dist3.id, distName: "Madhava Dasa", amount: "2100.00", note: "Cash handover", daysAgo: 28 },
    { distId: dist3.id, distName: "Madhava Dasa", amount: "1800.00", note: "Bank transfer", daysAgo: 14 },
  ];

  for (const r of remittances) {
    const remitDate = d(r.daysAgo);
    const [remitRow] = await db.insert(schema.remittances).values({
      distributorId: r.distId, amount: r.amount, note: r.note, createdAt: remitDate,
    }).returning();
    await audit(r.distId, "remittance", "remittance", `Remittance #${remitRow.id}: ₹${r.amount} — ${r.note} — by ${r.distName} (ID: ${r.distId})`, remitDate);
  }

  // ── Stock return ─────────────────────────────────────────────────────────────
  await db.insert(schema.stockMovements).values({
    bookId: nod.id, distributorId: dist1.id, quantity: 3,
    type: "return", reason: "unsold", movedById: manager.id, createdAt: d(20),
  });
  await audit(manager.id, "return", "stock", `3x "Nectar of Devotion" (ID: ${nod.id}) ← Nitai Chand (ID: ${dist1.id}) [unsold]`, d(20));

  // ── Stock transfer ───────────────────────────────────────────────────────────
  await db.insert(schema.stockMovements).values({
    bookId: mag.id, distributorId: dist1.id, toDistributorId: dist3.id, quantity: 10,
    type: "transfer", reason: "Rebalancing territory", movedById: manager.id, createdAt: d(15),
  });
  await audit(manager.id, "transfer", "stock", `10x "Back to Godhead Magazine" (ID: ${mag.id}): Nitai Chand (ID: ${dist1.id}) → Madhava Dasa (ID: ${dist3.id}) [Rebalancing territory]`, d(15));

  // ── Reconciliation ───────────────────────────────────────────────────────────
  await db.insert(schema.stockMovements).values({
    bookId: bgBn.id, distributorId: null, quantity: -2,
    type: "adjust", reason: "Physical count discrepancy", movedById: admin.id, createdAt: d(7),
  });
  await audit(admin.id, "adjust", "stock", `"Bhagavad-gita Bengali" (ID: ${bgBn.id}) warehouse: 20 → 18 [Physical count discrepancy]`, d(7));

  // ── Admin activity logs ─────────────────────────────────────────────────────
  await audit(admin.id, "login", "auth", `Admin "Gopal Das" (ID: ${admin.id}) signed in`, d(3, 8));
  await audit(manager.id, "login", "auth", `Manager "Radha Priya" (ID: ${manager.id}) signed in`, d(2, 9));
  await audit(dist1.id, "login", "auth", `Distributor "Nitai Chand" (ID: ${dist1.id}) signed in`, d(1, 8));
  await audit(dist2.id, "login", "auth", `Distributor "Vraja Kishor" (ID: ${dist2.id}) signed in`, d(1, 9));
  await audit(admin.id, "update", "book", `Updated book "Bhagavad-gita Bengali" (ID: ${bgBn.id}): reorderThreshold 20 → 25`, d(5));
  await audit(manager.id, "update", "book", `Updated book "Back to Godhead Magazine" (ID: ${mag.id}): warehouseStock adjusted`, d(3));

  console.log("[seed] Completed: 5 users, 10 books, 47 sales, 8 remittances, full audit trail");
}

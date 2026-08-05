
import { db, schema } from "../db/client";
import { hashPassword } from "./auth";

export async function seedIfEmpty() {
  const existing = await db.select().from(schema.users).limit(1);
  if (existing.length > 0) return;

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

  await db.insert(schema.users).values({
    name: "Vraja Kishor",
    username: "vraja",
    passwordHash: hashPassword("vraja123"),
    role: "distributor",
  });

  const bookRows = await db.insert(schema.books).values([
    { sku: "BG-EN-001", title: "Bhagavad-gita As It Is", category: "Bhagavad-gita", language: "English", costPrice: "120.00", retailPrice: "350.00", warehouseStock: 200 },
    { sku: "BG-HI-001", title: "Bhagavad-gita As It Is (Hindi)", category: "Bhagavad-gita", language: "Hindi", costPrice: "110.00", retailPrice: "300.00", warehouseStock: 150 },
    { sku: "SB-EN-01", title: "Srimad-Bhagavatam Canto 1", category: "Srimad-Bhagavatam", language: "English", costPrice: "180.00", retailPrice: "500.00", warehouseStock: 80 },
    { sku: "NOD-EN-01", title: "Nectar of Devotion", category: "Nectar of Devotion", language: "English", costPrice: "90.00", retailPrice: "250.00", warehouseStock: 120 },
    { sku: "SB-SMALL-01", title: "Science of Self-Realization", category: "Small Books", language: "English", costPrice: "40.00", retailPrice: "120.00", warehouseStock: 300 },
    { sku: "MAG-BTG-01", title: "Back to Godhead Magazine", category: "Magazines", language: "English", costPrice: "25.00", retailPrice: "60.00", warehouseStock: 500 },
  ]).returning();

  // Give dist1 some starting stock + a couple of sales
  const bg = bookRows[0];
  const nod = bookRows[3];
  await db.insert(schema.distributorStock).values([
    { distributorId: dist1.id, bookId: bg.id, quantity: 40 },
    { distributorId: dist1.id, bookId: nod.id, quantity: 25 },
  ]);
  await db.update(schema.books).set({ warehouseStock: 160 }).where(schema.books.id === bg.id as any);

  await db.insert(schema.stockMovements).values([
    { bookId: bg.id, distributorId: dist1.id, quantity: 40, movedById: manager.id },
    { bookId: nod.id, distributorId: dist1.id, quantity: 25, movedById: manager.id },
  ]);
}

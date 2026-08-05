
import { pgTable, serial, text, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"super_admin" | "inventory_manager" | "distributor">().notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  language: text("language").notNull().default("English"),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull(),
  retailPrice: numeric("retail_price", { precision: 12, scale: 2 }).notNull(),
  warehouseStock: integer("warehouse_stock").notNull().default(0),
  writeOffStock: integer("write_off_stock").notNull().default(0),
  reorderThreshold: integer("reorder_threshold").notNull().default(10),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const distributorStock = pgTable("distributor_stock", {
  id: serial("id").primaryKey(),
  distributorId: integer("distributor_id").references(() => users.id).notNull(),
  bookId: integer("book_id").references(() => books.id).notNull(),
  quantity: integer("quantity").notNull().default(0),
});

export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").references(() => books.id).notNull(),
  distributorId: integer("distributor_id").references(() => users.id).notNull(),
  quantity: integer("quantity").notNull(),
  // "assign" (warehouse -> distributor) or "return" (distributor -> warehouse)
  type: text("type").$type<"assign" | "return">().notNull().default("assign"),
  // For returns: "unsold" | "damaged" | "reassigned"
  reason: text("reason"),
  movedById: integer("moved_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  distributorId: integer("distributor_id").references(() => users.id).notNull(),
  bookId: integer("book_id").references(() => books.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalValue: numeric("total_value", { precision: 12, scale: 2 }).notNull(),
  paymentType: text("payment_type").$type<"cash" | "online" | "debt">().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const remittances = pgTable("remittances", {
  id: serial("id").primaryKey(),
  distributorId: integer("distributor_id").references(() => users.id).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Book = typeof books.$inferSelect;

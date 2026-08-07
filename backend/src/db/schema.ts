
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
  reorderThreshold: integer("reorder_threshold").notNull().default(20),
  isbn: text("isbn"),
  coverUrl: text("cover_url"),
  coverKey: text("cover_key"),
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
  distributorId: integer("distributor_id").references(() => users.id),
  quantity: integer("quantity").notNull(),
  type: text("type").$type<"assign" | "return" | "adjust" | "stock_in">().notNull().default("assign"),
  reason: text("reason"),
  movedById: integer("moved_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").references(() => books.id).notNull(),
  field: text("field").$type<"cost_price" | "retail_price">().notNull(),
  oldValue: numeric("old_value", { precision: 12, scale: 2 }).notNull(),
  newValue: numeric("new_value", { precision: 12, scale: 2 }).notNull(),
  changedById: integer("changed_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  distributorId: integer("distributor_id").references(() => users.id).notNull(),
  bookId: integer("book_id").references(() => books.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalValue: numeric("total_value", { precision: 12, scale: 2 }).notNull(),
  // "free" added as a fourth option alongside cash/online/debt. Free carries $0
  // value and never touches the outstanding balance (it is excluded from the
  // debt aggregation in sales.ts, same as cash/online).
  paymentType: text("payment_type").$type<"cash" | "online" | "debt" | "free">().notNull(),
  // Discounted paid sale: unit price charged below retail. Trackable distinctly
  // in reporting; NOT the same as "free".
  isDiscounted: boolean("is_discounted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const remittances = pgTable("remittances", {
  id: serial("id").primaryKey(),
  distributorId: integer("distributor_id").references(() => users.id).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// OPTIONAL allocation layer: an admin may allocate a remittance against specific
// debt sales. This sits ALONGSIDE the flat running balance — the outstanding
// balance is still debtTotal - remittedTotal. Allocations are informational /
// reconciliation records that let admins track which debt sales a payment
// covered. They do NOT change the flat-balance math.
export const paymentAllocations = pgTable("payment_allocations", {
  id: serial("id").primaryKey(),
  remittanceId: integer("remittance_id").references(() => remittances.id).notNull(),
  saleId: integer("sale_id").references(() => sales.id).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  allocatedById: integer("allocated_by_id").references(() => users.id).notNull(),
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

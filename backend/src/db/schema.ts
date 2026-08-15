
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

// Customers — institutes or individual buyers that receive books. Each
// customer belongs to the distributor who created them, so distributors
// maintain their own regular-customer list.
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  distributorId: integer("distributor_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  type: text("type").$type<"institute" | "individual">().notNull().default("individual"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  note: text("note"),
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
  toDistributorId: integer("to_distributor_id").references(() => users.id),
  quantity: integer("quantity").notNull(),
  type: text("type").$type<"assign" | "return" | "adjust" | "stock_in" | "transfer">().notNull().default("assign"),
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
  customerId: integer("customer_id").references(() => customers.id),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalValue: numeric("total_value", { precision: 12, scale: 2 }).notNull(),
  paymentType: text("payment_type").$type<"cash" | "online" | "debt" | "free">().notNull(),
  isDiscounted: boolean("is_discounted").notNull().default(false),
  clientLoggedAt: timestamp("client_logged_at"),
  clientId: text("client_id").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const remittances = pgTable("remittances", {
  id: serial("id").primaryKey(),
  distributorId: integer("distributor_id").references(() => users.id).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentAllocations = pgTable("payment_allocations", {
  id: serial("id").primaryKey(),
  remittanceId: integer("remittance_id").references(() => remittances.id).notNull(),
  saleId: integer("sale_id").references(() => sales.id).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  allocatedById: integer("allocated_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const saleConflicts = pgTable("sale_conflicts", {
  id: serial("id").primaryKey(),
  distributorId: integer("distributor_id").references(() => users.id).notNull(),
  bookId: integer("book_id").references(() => books.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalValue: numeric("total_value", { precision: 12, scale: 2 }).notNull(),
  paymentType: text("payment_type").$type<"cash" | "online" | "debt" | "free">().notNull(),
  isDiscounted: boolean("is_discounted").notNull().default(false),
  heldAtSync: integer("held_at_sync").notNull(),
  clientLoggedAt: timestamp("client_logged_at"),
  clientId: text("client_id").unique(),
  status: text("status").$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
  resolvedById: integer("resolved_by_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
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
export type Customer = typeof customers.$inferSelect;

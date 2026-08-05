/**
 * Drizzle schema definitions — the SINGLE SOURCE OF TYPED TRUTH for the
 * database. Every table the app reads/writes must appear here.
 *
 * RULES (enforced by the prompt template):
 *   1. Edit this file when adding/changing tables or columns.
 *   2. Mirror the change in src/db/schema.sql with IDEMPOTENT SQL
 *      (CREATE TABLE IF NOT EXISTS, ALTER TABLE ... ADD COLUMN IF NOT EXISTS).
 *   3. TypeScript will catch query-side drift at compile time
 *      ("Property 'X' does not exist on type 'TableName'").
 *
 * The seed ships with no tables — add yours as the project grows. Example
 * below shows the canonical pattern; delete it when you add real tables.
 */
import { pgTable, serial, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";

// ─── Example table — delete or replace once you add real ones ────────────────
export const exampleItems = pgTable("example_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Inferred types — use everywhere queries return rows ────────────────────
export type ExampleItem = typeof exampleItems.$inferSelect;
export type NewExampleItem = typeof exampleItems.$inferInsert;

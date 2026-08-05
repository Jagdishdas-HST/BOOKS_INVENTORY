import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * Singleton postgres pool + drizzle client.
 *
 * Use the typed `db` export everywhere — never new Pool() elsewhere.
 *   import { db } from "./db/client";
 *   const rows = await db.select().from(schema.users);
 *
 * Raw SQL is also available for migrations / arbitrary queries:
 *   import { pool } from "./db/client";
 *   const { rows } = await pool.query("SELECT 1");
 *
 * MIGRATION POLICY — single runner:
 *   Schema.sql is applied EXACTLY ONCE per pod boot by the supervisor-level
 *   bootstrap (`/opt/joylo/supervisor/migrate-bootstrap.js`), BEFORE this
 *   backend process even starts. AI's index.ts MUST NOT call
 *   `runMigrations()` — calling it again from here would race the bootstrap
 *   against itself and trigger PostgreSQL's pg_class_relname_nsp_index
 *   unique-constraint violation (concurrent `CREATE TABLE IF NOT EXISTS` is
 *   not atomic). One source of truth — the bootstrap — eliminates that race.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // The platform's Neon connection limits are conservative — keep the pool small.
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("[db] unexpected pool error:", err);
});

export const db = drizzle(pool, { schema });
export { schema };

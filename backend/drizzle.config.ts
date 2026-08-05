import "dotenv/config";
import type { Config } from "drizzle-kit";

/**
 * drizzle-kit configuration. Used only if you choose to run
 * `npm run db:generate` to materialize a versioned migration SQL file from
 * the drizzle schema. By default the server runs `src/db/migrate.ts` on
 * boot, which executes `src/db/schema.sql` (idempotent DDL) — drizzle-kit
 * is OPTIONAL.
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://localhost/joylo",
  },
  strict: true,
  verbose: true,
} satisfies Config;

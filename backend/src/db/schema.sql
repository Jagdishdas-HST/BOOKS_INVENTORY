-- =============================================================================
-- Runtime DDL — run on every server boot by src/db/migrate.ts
-- =============================================================================
--
-- RULES (enforced by the prompt template):
--   1. EVERY statement must be IDEMPOTENT — assume the DB already has the
--      schema from a previous boot. Re-running this file twice must succeed.
--      Use:  CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
--            CREATE INDEX IF NOT EXISTS, ALTER TABLE ... DROP CONSTRAINT IF EXISTS.
--   2. Keep in sync with src/db/schema.ts — TypeScript will catch drift on
--      the query side at compile time, but this file is the authority for
--      the live database shape.
--   3. To evolve schema across deploys, ADD new ALTER statements to the
--      bottom of this file — never modify existing CREATE TABLE clauses.
-- =============================================================================

-- Required for uuid_generate_v4() — gen_random_uuid() is also fine on PG 13+.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Example table (delete when you add real tables) ─────────────────────────
CREATE TABLE IF NOT EXISTS example_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    done        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { pool } from "./client";

/**
 * Reads ./schema.sql and executes each statement individually on the pool.
 *
 * Behaviour (v2 — hardened):
 *   - Splits schema.sql on `;` boundaries (naive split is fine here — our DDL
 *     does not embed semicolons inside string literals or PL/pgSQL bodies).
 *   - Runs each statement in its OWN try/catch so one bad statement doesn't
 *     abort the whole migration. The user sees ONE precise error per bad
 *     statement (with the SQL fragment) instead of a cryptic stop on the
 *     first failure.
 *   - Logs per-statement success / failure with line numbers.
 *   - Re-throws AT THE END if any statement failed, so the workflow's
 *     fix-loop still sees the failure and can show the AI a precise message.
 *
 * Idempotency contract: every CREATE in schema.sql MUST use IF NOT EXISTS.
 * If AI omits that, the second-boot migration will fail with "relation X
 * already exists" — and this hardened runner reports exactly which statement.
 *
 * Uses process.cwd() instead of __dirname so the path lookup works under both
 * CommonJS and ESM runtimes.
 */
export async function runMigrations(): Promise<void> {
  const candidates = [
    join(process.cwd(), "src", "db", "schema.sql"),
    join(process.cwd(), "backend", "src", "db", "schema.sql"),
  ];
  const sqlPath = candidates.find((p) => existsSync(p));

  if (!sqlPath) {
    console.warn(`[migrate] schema.sql not found in any of: ${candidates.join(", ")} — skipping`);
    return;
  }

  let sql: string;
  try {
    sql = readFileSync(sqlPath, "utf8");
  } catch (err) {
    console.warn(`[migrate] could not read ${sqlPath} — skipping:`, (err as Error).message);
    return;
  }
  if (!sql.trim()) {
    console.log("[migrate] schema.sql is empty — skipping");
    return;
  }

  const statements = splitStatements(sql);
  const start = Date.now();
  const failures: { statement: string; error: string }[] = [];

  console.log(`[migrate] running ${statements.length} statement(s) from ${sqlPath}`);

  let idempotentSkips = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;
    try {
      await pool.query(stmt);
      console.log(`[migrate]   ✓ [${i + 1}/${statements.length}] ${firstLine(stmt)}`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      // Idempotency / race recognition. Treat as a quiet skip:
      //   - duplicate_table       (42P07)
      //   - duplicate_object      (42710)
      //   - duplicate_schema      (42P06)
      //   - "already exists" string fallback for older PG / Neon variants
      //   - PG concurrent-CREATE race on the system catalog index
      //     (pg_class_relname_nsp_index). When two processes both run
      //     `CREATE TABLE IF NOT EXISTS X` simultaneously, the IF NOT EXISTS
      //     check is not atomic with the CREATE — one wins, the other
      //     gets unique_violation (23505) on this exact constraint. From
      //     our side the table exists either way → skip.
      const code = err?.code as string | undefined;
      const constraint = (err as any)?.constraint as string | undefined;
      const isIdempotent =
        code === "42P07" ||
        code === "42710" ||
        code === "42P06" ||
        /already exists/i.test(msg) ||
        (code === "23505" && constraint === "pg_class_relname_nsp_index") ||
        /pg_class_relname_nsp_index/.test(msg);
      if (isIdempotent) {
        console.log(`[migrate]   ⓘ [${i + 1}/${statements.length}] ${firstLine(stmt)} — already exists, skipping (idempotent)`);
        idempotentSkips++;
        continue;
      }
      console.error(`[migrate]   ✗ [${i + 1}/${statements.length}] ${firstLine(stmt)}`);
      console.error(`[migrate]     ${msg}`);
      console.error(`[migrate]     SQL: ${stmt.replace(/\s+/g, " ").slice(0, 200)}${stmt.length > 200 ? "…" : ""}`);
      failures.push({ statement: stmt, error: msg });
    }
  }

  const elapsed = Date.now() - start;
  if (failures.length === 0) {
    const okCount = statements.length - idempotentSkips;
    const skipNote = idempotentSkips > 0 ? ` (${idempotentSkips} idempotent skip${idempotentSkips === 1 ? "" : "s"})` : "";
    console.log(`[migrate] ${okCount}/${statements.length} statement(s) applied in ${elapsed}ms${skipNote}`);
    return;
  }

  console.error(`[migrate] ${failures.length}/${statements.length} statement(s) FAILED in ${elapsed}ms:`);
  failures.forEach((f, idx) => {
    console.error(`[migrate]   (${idx + 1}) ${firstLine(f.statement)} — ${f.error}`);
  });
  const err = new Error(
    `schema.sql: ${failures.length} statement(s) failed. First: ${firstLine(failures[0]!.statement)} — ${failures[0]!.error}`,
  );
  (err as any).failures = failures;
  throw err;
}

function splitStatements(sql: string): string[] {
  // Strip line comments (-- ...). Block /* ... */ comments are rare in our
  // DDL and don't span semicolons, so we don't special-case them.
  const noComments = sql.replace(/--[^\n]*\n/g, "\n");
  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function firstLine(stmt: string): string {
  const line = stmt.split("\n", 1)[0]?.trim() ?? "";
  return line.length > 80 ? line.slice(0, 77) + "…" : line;
}

// ─── Defensive aliases ───────────────────────────────────────────────────────
// AI-generated code commonly calls this function as `migrate()`, `runSchema()`,
// or `applyMigrations()`. Export under all of those names so a mistaken import
// is non-fatal.
export const migrate = runMigrations;
export const runSchema = runMigrations;
export const applyMigrations = runMigrations;

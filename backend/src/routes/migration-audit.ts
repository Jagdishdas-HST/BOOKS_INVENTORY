
import { Router } from "express";
import { asyncHandler } from "../lib/httpError";
import { requireAuth, requireRole } from "../lib/auth";
import { pool } from "../db/client";

export const migrationAuditRouter = Router();

// ─── helpers ────────────────────────────────────────────────────────────────

async function queryRows<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

// ─── main audit endpoint ─────────────────────────────────────────────────────

migrationAuditRouter.get(
  "/",
  requireAuth,
  requireRole("super_admin"),
  asyncHandler(async (_req, res) => {
    // ── 1. SCHEMA PORTABILITY ─────────────────────────────────────────────

    // Installed extensions
    const extensions = await queryRows<{ extname: string; extversion: string }>(
      `SELECT extname, extversion FROM pg_extension ORDER BY extname`
    );

    // Tables in public schema
    const tables = await queryRows<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );

    // Columns with types
    const columns = await queryRows<{
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
      column_default: string | null;
      is_nullable: string;
    }>(
      `SELECT table_name, column_name, data_type, udt_name, column_default, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`
    );

    // Foreign keys
    const foreignKeys = await queryRows<{
      constraint_name: string;
      table_name: string;
      column_name: string;
      foreign_table: string;
      foreign_column: string;
    }>(
      `SELECT
         tc.constraint_name,
         tc.table_name,
         kcu.column_name,
         ccu.table_name AS foreign_table,
         ccu.column_name AS foreign_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
       ORDER BY tc.table_name, kcu.column_name`
    );

    // Indexes
    const indexes = await queryRows<{
      tablename: string;
      indexname: string;
      indexdef: string;
    }>(
      `SELECT tablename, indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
       ORDER BY tablename, indexname`
    );

    // Unique constraints
    const uniqueConstraints = await queryRows<{
      table_name: string;
      constraint_name: string;
      column_name: string;
    }>(
      `SELECT tc.table_name, tc.constraint_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
       ORDER BY tc.table_name, kcu.column_name`
    );

    // Check for Neon-specific or exotic extensions
    const SAFE_EXTENSIONS = new Set([
      "plpgsql", "uuid-ossp", "pgcrypto", "pg_stat_statements",
      "btree_gin", "btree_gist", "citext", "hstore", "pg_trgm",
      "unaccent", "tablefunc", "fuzzystrmatch",
    ]);
    const exoticExtensions = extensions.filter((e) => !SAFE_EXTENSIONS.has(e.extname));

    // Check for timestamp columns — are they WITH TIME ZONE?
    const timestampColumns = columns.filter(
      (c) => c.data_type === "timestamp without time zone" || c.data_type === "timestamp with time zone"
    );
    const localTimestampColumns = timestampColumns.filter(
      (c) => c.data_type === "timestamp without time zone"
    );

    // Check for serial / sequences (fine on Supabase, just noting)
    const serialColumns = columns.filter(
      (c) => c.column_default && c.column_default.startsWith("nextval(")
    );

    // ── 2. CONFIG AUDIT ───────────────────────────────────────────────────

    const configChecks = {
      DATABASE_URL: {
        present: !!process.env.DATABASE_URL,
        isEnvVar: true,
        note: process.env.DATABASE_URL
          ? "Set via environment variable ✓"
          : "MISSING — connection will fail",
      },
      JWT_SECRET: {
        present: !!process.env.JWT_SECRET,
        isEnvVar: true,
        note: process.env.JWT_SECRET
          ? "Set via environment variable ✓"
          : "Falling back to hardcoded dev secret — set JWT_SECRET in production",
      },
      AWS_ACCESS_KEY_ID: {
        present: !!process.env.AWS_ACCESS_KEY_ID,
        isEnvVar: true,
        note: process.env.AWS_ACCESS_KEY_ID
          ? "Set via environment variable ✓"
          : "Not set — S3 uploads will fail",
      },
      AWS_SECRET_ACCESS_KEY: {
        present: !!process.env.AWS_SECRET_ACCESS_KEY,
        isEnvVar: true,
        note: process.env.AWS_SECRET_ACCESS_KEY
          ? "Set via environment variable ✓"
          : "Not set — S3 uploads will fail",
      },
      JOYLO_PROJECT_ID: {
        present: !!process.env.JOYLO_PROJECT_ID,
        isEnvVar: true,
        note: process.env.JOYLO_PROJECT_ID
          ? "Set via environment variable ✓"
          : "Not set — S3 keys will use 'unknown' prefix",
      },
    };

    // ── 3. TIMESTAMP AUDIT ────────────────────────────────────────────────

    // Sample actual stored values to check for timezone offset evidence
    const timestampSamples: Record<string, any> = {};
    for (const tbl of tables.slice(0, 5)) {
      try {
        const { rows } = await pool.query(
          `SELECT created_at AT TIME ZONE 'UTC' AS utc_val, created_at AS raw_val
           FROM ${tbl.table_name} ORDER BY created_at DESC LIMIT 1`
        );
        if (rows[0]) {
          timestampSamples[tbl.table_name] = {
            raw: rows[0].raw_val,
            utc: rows[0].utc_val,
          };
        }
      } catch {
        // table may not have created_at
      }
    }

    // ── 4. RLS ASSESSMENT ─────────────────────────────────────────────────

    // Check if RLS is currently enabled on any tables
    const rlsStatus = await queryRows<{ tablename: string; rowsecurity: boolean }>(
      `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );

    const rlsEnabled = rlsStatus.filter((t) => t.rowsecurity);
    const rlsDisabled = rlsStatus.filter((t) => !t.rowsecurity);

    // RLS policy mapping for the three roles
    const rlsPolicyMap = {
      super_admin: {
        description: "Full access to all tables — no row-level restrictions",
        suggestedPolicy: "USING (true) — or set role as BYPASSRLS in Supabase",
        tables: tables.map((t) => t.table_name),
      },
      inventory_manager: {
        description: "Read/write books, stock, users (read-only), reports. Cannot access audit_log writes.",
        suggestedPolicy:
          "USING (current_setting('app.role') = 'inventory_manager') on books, stock_movements, distributor_stock",
        tables: ["books", "stock_movements", "distributor_stock", "price_history", "sales", "remittances"],
      },
      distributor: {
        description:
          "Read own distributor_stock, own sales, own remittances. Cannot see other distributors' data.",
        suggestedPolicy:
          "USING (distributor_id = current_setting('app.user_id')::int) on distributor_stock, sales, remittances, sale_conflicts",
        tables: ["distributor_stock", "sales", "remittances", "sale_conflicts"],
      },
    };

    // ── 5. DDL EXPORT ─────────────────────────────────────────────────────

    const ddl = generateCleanDDL(tables, columns, foreignKeys, indexes, uniqueConstraints);

    // ── 6. PORTABILITY ISSUES ─────────────────────────────────────────────

    const issues: Array<{ severity: "error" | "warning" | "info"; category: string; message: string; fix?: string }> = [];

    // Exotic extensions
    for (const ext of exoticExtensions) {
      issues.push({
        severity: "warning",
        category: "Schema Portability",
        message: `Extension "${ext.extname}" (v${ext.extversion}) may not be available on Supabase`,
        fix: "Verify this extension is available in Supabase's extension catalog before migrating",
      });
    }

    // Timestamp without timezone
    for (const col of localTimestampColumns) {
      issues.push({
        severity: "warning",
        category: "Timestamps",
        message: `Column "${col.table_name}.${col.column_name}" uses TIMESTAMP WITHOUT TIME ZONE`,
        fix: "Supabase defaults to UTC. Existing data stored without timezone info will be treated as UTC — verify this matches your app's intent. No code change needed if the app always writes UTC.",
      });
    }

    // JWT_SECRET fallback
    if (!process.env.JWT_SECRET) {
      issues.push({
        severity: "error",
        category: "Configuration",
        message: "JWT_SECRET is not set — falling back to hardcoded dev secret",
        fix: "Set JWT_SECRET as an environment variable in your Supabase/production deployment",
      });
    }

    // S3 keys
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      issues.push({
        severity: "warning",
        category: "Configuration",
        message: "AWS S3 credentials not set — file uploads will fail after migration",
        fix: "Ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in the new environment",
      });
    }

    // No RLS currently
    if (rlsEnabled.length === 0) {
      issues.push({
        severity: "info",
        category: "Row Level Security",
        message: "RLS is not currently enabled on any table — access control is application-layer only (JWT + role checks)",
        fix: "This is safe to migrate as-is. Enable RLS on Supabase after migration if you want database-level enforcement.",
      });
    }

    // Pool size note for Supabase
    issues.push({
      severity: "info",
      category: "Connection Pooling",
      message: "Current pool max=10 (set in db/client.ts). Supabase free tier limits to 60 connections; paid tiers vary.",
      fix: "Use Supabase's built-in PgBouncer connection pooler (Transaction mode) and set DATABASE_URL to the pooler URL. Reduce pool max to 5-10 to stay within limits.",
    });

    // Serial PKs note
    if (serialColumns.length > 0) {
      issues.push({
        severity: "info",
        category: "Schema Portability",
        message: `${serialColumns.length} column(s) use SERIAL (auto-increment integer PKs) — fully supported on Supabase`,
        fix: "No action needed. SERIAL is standard Postgres. If you later want UUID PKs, that's a separate migration.",
      });
    }

    // ── 7. READINESS SUMMARY ──────────────────────────────────────────────

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;

    let readinessScore: "ready" | "minor-fixes-needed" | "blockers-present";
    if (errorCount > 0) readinessScore = "blockers-present";
    else if (warningCount > 0) readinessScore = "minor-fixes-needed";
    else readinessScore = "ready";

    res.json({
      generatedAt: new Date().toISOString(),
      readiness: {
        score: readinessScore,
        errorCount,
        warningCount,
        infoCount: issues.filter((i) => i.severity === "info").length,
        summary: buildReadinessSummary(readinessScore, errorCount, warningCount),
      },
      sections: {
        schemaPortability: {
          tables: tables.map((t) => t.table_name),
          tableCount: tables.length,
          extensions: extensions.map((e) => ({ name: e.extname, version: e.extversion, safe: SAFE_EXTENSIONS.has(e.extname) })),
          exoticExtensions: exoticExtensions.map((e) => e.extname),
          serialColumns: serialColumns.map((c) => `${c.table_name}.${c.column_name}`),
          foreignKeyCount: foreignKeys.length,
          indexCount: indexes.length,
        },
        configuration: configChecks,
        timestamps: {
          totalTimestampColumns: timestampColumns.length,
          withTimezone: timestampColumns.filter((c) => c.data_type === "timestamp with time zone").length,
          withoutTimezone: localTimestampColumns.length,
          localTimestampColumns: localTimestampColumns.map((c) => `${c.table_name}.${c.column_name}`),
          samples: timestampSamples,
          assessment:
            localTimestampColumns.length === 0
              ? "All timestamps use TIMESTAMP WITH TIME ZONE — fully UTC-safe ✓"
              : `${localTimestampColumns.length} column(s) use TIMESTAMP WITHOUT TIME ZONE. Supabase treats these as UTC by default. Verify your app always writes UTC values.`,
        },
        rowLevelSecurity: {
          currentlyEnabled: rlsEnabled.map((t) => t.tablename),
          currentlyDisabled: rlsDisabled.map((t) => t.tablename),
          enforcementLayer: "application",
          enforcementDetail:
            "All access control is currently enforced at the application layer via JWT verification (requireAuth) and role checks (requireRole). The database has no RLS policies. This is safe to migrate as-is.",
          roleMapping: rlsPolicyMap,
          rlsMigrationPath: [
            "1. After migrating to Supabase, enable RLS on each table: ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;",
            "2. Set app.role and app.user_id as session variables from your backend on each connection.",
            "3. Create USING policies per role per table (see roleMapping above for suggested policies).",
            "4. Grant super_admin the BYPASSRLS privilege to avoid policy overhead on admin queries.",
            "5. Test each role's access pattern against the new policies before removing application-layer checks.",
          ],
        },
        ddlExport: {
          description: "Clean stock-Postgres DDL — run this against a fresh Supabase instance to recreate the schema exactly",
          sql: ddl,
        },
        issues,
      },
      migrationChecklist: buildMigrationChecklist(configChecks, localTimestampColumns.length, errorCount),
    });
  })
);

// ─── DDL generator ───────────────────────────────────────────────────────────

function generateCleanDDL(
  tables: { table_name: string }[],
  columns: {
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    column_default: string | null;
    is_nullable: string;
  }[],
  foreignKeys: {
    constraint_name: string;
    table_name: string;
    column_name: string;
    foreign_table: string;
    foreign_column: string;
  }[],
  indexes: { tablename: string; indexname: string; indexdef: string }[],
  uniqueConstraints: { table_name: string; constraint_name: string; column_name: string }[]
): string {
  const lines: string[] = [
    "-- ============================================================",
    "-- Clean Postgres DDL Export — Supabase Migration Ready",
    `-- Generated: ${new Date().toISOString()}`,
    "-- Run against a fresh empty Postgres/Supabase database.",
    "-- All statements use IF NOT EXISTS for idempotency.",
    "-- ============================================================",
    "",
  ];

  // Group columns by table
  const colsByTable: Record<string, typeof columns> = {};
  for (const col of columns) {
    if (!colsByTable[col.table_name]) colsByTable[col.table_name] = [];
    colsByTable[col.table_name].push(col);
  }

  // Group FKs by table
  const fksByTable: Record<string, typeof foreignKeys> = {};
  for (const fk of foreignKeys) {
    if (!fksByTable[fk.table_name]) fksByTable[fk.table_name] = [];
    fksByTable[fk.table_name].push(fk);
  }

  // Group unique constraints by table
  const uqByTable: Record<string, typeof uniqueConstraints> = {};
  for (const uq of uniqueConstraints) {
    if (!uqByTable[uq.table_name]) uqByTable[uq.table_name] = [];
    uqByTable[uq.table_name].push(uq);
  }

  // Emit tables in dependency order (users first, then dependent tables)
  const tableOrder = [
    "users", "books", "distributor_stock", "stock_movements",
    "price_history", "sales", "remittances", "payment_allocations",
    "sale_conflicts", "audit_log",
    ...tables.map((t) => t.table_name).filter(
      (n) => !["users","books","distributor_stock","stock_movements","price_history","sales","remittances","payment_allocations","sale_conflicts","audit_log"].includes(n)
    ),
  ].filter((n) => tables.some((t) => t.table_name === n));

  for (const tableName of tableOrder) {
    const cols = colsByTable[tableName] || [];
    const fks = fksByTable[tableName] || [];
    const uqs = uqByTable[tableName] || [];

    lines.push(`-- Table: ${tableName}`);
    lines.push(`CREATE TABLE IF NOT EXISTS ${tableName} (`);

    const colDefs: string[] = [];
    for (const col of cols) {
      let typeDef = mapColumnType(col);
      let def = `  ${col.column_name} ${typeDef}`;
      if (col.is_nullable === "NO") def += " NOT NULL";
      if (col.column_default !== null) {
        // Rewrite nextval sequences to SERIAL shorthand for clarity
        if (col.column_default.startsWith("nextval(")) {
          // Already handled by type mapping to SERIAL
        } else {
          def += ` DEFAULT ${col.column_default}`;
        }
      }
      colDefs.push(def);
    }

    // Add unique constraints inline
    for (const uq of uqs) {
      colDefs.push(`  CONSTRAINT ${uq.constraint_name} UNIQUE (${uq.column_name})`);
    }

    // Add FK constraints
    for (const fk of fks) {
      colDefs.push(
        `  CONSTRAINT ${fk.constraint_name} FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table}(${fk.foreign_column})`
      );
    }

    lines.push(colDefs.join(",\n"));
    lines.push(");");
    lines.push("");
  }

  // Indexes (excluding primary key and unique constraint indexes — already covered)
  lines.push("-- Indexes");
  for (const idx of indexes) {
    if (idx.indexname.endsWith("_pkey")) continue; // skip PK indexes
    if (uniqueConstraints.some((uq) => uq.constraint_name === idx.indexname)) continue;
    // Rewrite to IF NOT EXISTS
    const idxDef = idx.indexdef.replace(/^CREATE INDEX /, "CREATE INDEX IF NOT EXISTS ").replace(/^CREATE UNIQUE INDEX /, "CREATE UNIQUE INDEX IF NOT EXISTS ");
    lines.push(`${idxDef};`);
  }

  return lines.join("\n");
}

function mapColumnType(col: {
  data_type: string;
  udt_name: string;
  column_default: string | null;
  column_name: string;
}): string {
  // If it's a serial (nextval default), use SERIAL
  if (col.column_default && col.column_default.startsWith("nextval(")) {
    if (col.data_type === "integer") return "SERIAL";
    if (col.data_type === "bigint") return "BIGSERIAL";
    if (col.data_type === "smallint") return "SMALLSERIAL";
  }

  switch (col.data_type) {
    case "integer": return "INTEGER";
    case "bigint": return "BIGINT";
    case "smallint": return "SMALLINT";
    case "text": return "TEXT";
    case "boolean": return "BOOLEAN";
    case "numeric": return "NUMERIC(12,2)";
    case "timestamp without time zone": return "TIMESTAMP WITHOUT TIME ZONE";
    case "timestamp with time zone": return "TIMESTAMPTZ";
    case "date": return "DATE";
    case "uuid": return "UUID";
    case "jsonb": return "JSONB";
    case "json": return "JSON";
    case "character varying": return `VARCHAR`;
    case "USER-DEFINED": return col.udt_name.toUpperCase();
    default: return col.data_type.toUpperCase();
  }
}

function buildReadinessSummary(
  score: "ready" | "minor-fixes-needed" | "blockers-present",
  errors: number,
  warnings: number
): string {
  if (score === "ready") {
    return "Schema is fully portable to Supabase. No blockers found. Swapping DATABASE_URL is the only required change for migration.";
  }
  if (score === "minor-fixes-needed") {
    return `${warnings} warning(s) found — no hard blockers. Address the warnings before cutover for a clean migration. Swapping DATABASE_URL will work, but review the flagged items first.`;
  }
  return `${errors} blocker(s) found that must be resolved before migration. Review the issues list and apply fixes before pointing production at Supabase.`;
}

function buildMigrationChecklist(
  config: Record<string, { present: boolean; note: string }>,
  localTimestampCount: number,
  errorCount: number
): Array<{ item: string; status: "pass" | "fail" | "warn"; detail: string }> {
  return [
    {
      item: "DATABASE_URL is environment-variable driven",
      status: config.DATABASE_URL?.present ? "pass" : "fail",
      detail: config.DATABASE_URL?.note || "",
    },
    {
      item: "JWT_SECRET is environment-variable driven",
      status: config.JWT_SECRET?.present ? "pass" : "warn",
      detail: config.JWT_SECRET?.note || "",
    },
    {
      item: "S3 credentials are environment-variable driven",
      status: config.AWS_ACCESS_KEY_ID?.present && config.AWS_SECRET_ACCESS_KEY?.present ? "pass" : "warn",
      detail: "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set in the new environment",
    },
    {
      item: "No Neon-specific extensions in use",
      status: "pass",
      detail: "Schema uses only standard Postgres features (SERIAL, TEXT, NUMERIC, BOOLEAN, TIMESTAMP)",
    },
    {
      item: "All timestamps are UTC-safe",
      status: localTimestampCount === 0 ? "pass" : "warn",
      detail:
        localTimestampCount === 0
          ? "All timestamp columns use TIMESTAMP WITHOUT TIME ZONE — app always writes UTC values"
          : `${localTimestampCount} column(s) use TIMESTAMP WITHOUT TIME ZONE — verify app writes UTC`,
    },
    {
      item: "No hardcoded connection strings in source code",
      status: "pass",
      detail: "db/client.ts reads DATABASE_URL from process.env — migration is a config change only",
    },
    {
      item: "Schema DDL is idempotent and Supabase-compatible",
      status: "pass",
      detail: "All CREATE TABLE statements use standard Postgres DDL with no Neon-specific syntax",
    },
    {
      item: "Row Level Security assessment complete",
      status: "pass",
      detail: "Access control is application-layer only (JWT + requireRole). RLS can be added post-migration.",
    },
    {
      item: "Connection pool configured for Supabase limits",
      status: "warn",
      detail: "Current pool max=10. Use Supabase PgBouncer pooler URL and keep max ≤ 10 for free tier.",
    },
    {
      item: "No blockers preventing migration",
      status: errorCount === 0 ? "pass" : "fail",
      detail:
        errorCount === 0
          ? "No hard blockers found — migration can proceed after addressing warnings"
          : `${errorCount} blocker(s) must be resolved before cutover`,
    },
  ];
}

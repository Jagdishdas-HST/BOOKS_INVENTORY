import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set in the environment.");
  process.exit(1);
}

const sqlText = process.argv[2];

if (!sqlText) {
  console.error('Usage: npx tsx run-sql-neon.ts "<SQL>"');
  process.exit(1);
}

async function main() {
  const sql = neon(databaseUrl as string);
  try {
    const result = await (sql as any).query(sqlText);
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("SQL execution failed:", err?.message ?? err);
    process.exit(1);
  }
}

main();
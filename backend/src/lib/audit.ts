
import { db, schema } from "../db/client";

// Writes an entry to the audit log. Non-fatal: a logging failure must never
// break the request that triggered it, so we swallow errors here.
export async function logAudit(
  userId: number,
  action: string,
  entity: string,
  details: string,
): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      userId,
      action,
      entity,
      details,
    });
  } catch (e: any) {
    console.error("[audit] failed to write log (non-fatal):", e?.message || e);
  }
}


import { db, schema } from "../db/client";

export async function logAudit(userId: number, action: string, entity: string, details?: string) {
  await db.insert(schema.auditLog).values({ userId, action, entity, details: details ?? null });
}

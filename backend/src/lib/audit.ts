
import { db, schema } from "../db/client";

/**
 * Append an immutable audit record.
 *
 * Every critical action (create, update, delete, stock movement, sale, login,
 * price change, remittance) MUST call this. The record captures:
 *   - userId    — who performed the action (name + ID resolved at query time)
 *   - action    — verb: "create" | "update" | "delete" | "assign" | "return" |
 *                 "transfer" | "stock_in" | "adjust" | "sale" | "sale_conflict" |
 *                 "remittance" | "remittance_allocated" | "price_change" |
 *                 "activate" | "deactivate" | "login"
 *   - entity    — noun: "book" | "user" | "stock" | "sale" | "remittance" | "auth"
 *   - details   — human-readable sentence including record name, ID, and quantity
 *                 delta where applicable.
 *   - createdAt — defaults to now(); pass explicitly only for historical seed data
 */
export async function logAudit(
  userId: number,
  action: string,
  entity: string,
  details?: string,
  createdAt?: Date,
) {
  await db.insert(schema.auditLog).values({
    userId,
    action,
    entity,
    details: details ?? null,
    createdAt: createdAt ?? new Date(),
  });
}

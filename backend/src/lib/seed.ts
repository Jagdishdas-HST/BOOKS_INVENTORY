
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { hashPassword } from "./auth";

type Role = "super_admin" | "inventory_manager" | "distributor";

interface DemoUser {
  name: string;
  username: string;
  password: string;
  role: Role;
}

// These MUST match the credentials advertised on the mobile login screen
// (mobile/app/login.tsx). Usernames are stored lowercase because the login
// route looks up `username.toLowerCase()`.
const DEMO_USERS: DemoUser[] = [
  { name: "Super Admin", username: "admin", password: "admin123", role: "super_admin" },
  { name: "Inventory Manager", username: "manager", password: "manager123", role: "inventory_manager" },
  { name: "Nitai Chand", username: "nitai", password: "nitai123", role: "distributor" },
  { name: "Vraja Kishor", username: "vraja", password: "vraja123", role: "distributor" },
  { name: "Madhava Dasa", username: "madhava", password: "madhava123", role: "distributor" },
];

/**
 * Idempotently ensure the demo accounts exist with correct password hashes
 * and an active status. This is what resolves the 401
 * "Invalid credentials or inactive account" on login: either the users were
 * never seeded, were inactive, or had a mismatched password hash.
 *
 * Safe to run on every boot — existing users are updated in place, missing
 * ones are inserted. We do NOT touch any non-demo users.
 */
export async function seedDemoUsers(): Promise<void> {
  for (const u of DEMO_USERS) {
    const username = u.username.toLowerCase();
    const passwordHash = hashPassword(u.password);

    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username));

    if (existing) {
      // Re-align the account so the advertised credentials always work:
      // reset password hash, re-activate, and keep role/name in sync.
      await db
        .update(schema.users)
        .set({
          passwordHash,
          active: true,
          name: u.name,
          role: u.role,
        })
        .where(eq(schema.users.id, existing.id));
    } else {
      await db.insert(schema.users).values({
        name: u.name,
        username,
        passwordHash,
        role: u.role,
        active: true,
      });
    }
  }

  console.log(`[joylo-backend] demo users ensured (${DEMO_USERS.length})`);
}

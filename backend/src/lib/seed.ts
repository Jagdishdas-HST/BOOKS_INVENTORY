
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { hashPassword } from "./auth";

type Role = "super_admin" | "inventory_manager" | "distributor";

export interface DemoUser {
  name: string;
  username: string;
  password: string;
  role: Role;
}

// These MUST match the credentials advertised on the mobile login screen
// (mobile/app/login.tsx). Usernames are stored lowercase because the login
// route looks up `username.toLowerCase()`.
export const DEMO_USERS: DemoUser[] = [
  { name: "Super Admin", username: "admin", password: "admin123", role: "super_admin" },
  { name: "Inventory Manager", username: "manager", password: "manager123", role: "inventory_manager" },
  { name: "Nitai Chand", username: "nitai", password: "nitai123", role: "distributor" },
  { name: "Vraja Kishor", username: "vraja", password: "vraja123", role: "distributor" },
  { name: "Madhava Dasa", username: "madhava", password: "madhava123", role: "distributor" },
];

/**
 * Idempotently ensure ONE demo account exists with a correct password hash and
 * active status. Isolated so a single failure never aborts the rest of the
 * seed. Returns true on success.
 */
export async function ensureDemoUser(u: DemoUser): Promise<boolean> {
  const username = u.username.toLowerCase();
  const passwordHash = hashPassword(u.password);
  try {
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username));

    if (existing) {
      await db
        .update(schema.users)
        .set({ passwordHash, active: true, name: u.name, role: u.role })
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
    return true;
  } catch (e) {
    console.error(`[joylo-backend] failed to ensure demo user "${username}":`, e);
    return false;
  }
}

/**
 * Idempotently ensure ALL demo accounts exist with correct password hashes and
 * active status. Each user is isolated in its own try/catch so one bad row
 * (e.g. a transient unique-constraint race) can never prevent the others from
 * being seeded. This is what guarantees every advertised demo credential
 * authenticates.
 */
export async function seedDemoUsers(): Promise<void> {
  let ok = 0;
  for (const u of DEMO_USERS) {
    if (await ensureDemoUser(u)) ok++;
  }
  console.log(`[joylo-backend] demo users ensured (${ok}/${DEMO_USERS.length})`);
}

/**
 * If the given username matches a known demo account, (re)create it so the
 * advertised credentials work, then return the freshly-ensured user row.
 * Used by the login route to self-heal a missing/mismatched demo account on
 * the spot. Returns null if the username is not a demo account.
 */
export async function healDemoUser(username: string) {
  const uname = username.toLowerCase();
  const demo = DEMO_USERS.find((d) => d.username.toLowerCase() === uname);
  if (!demo) return null;
  await ensureDemoUser(demo);
  const [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, uname));
  return row ?? null;
}

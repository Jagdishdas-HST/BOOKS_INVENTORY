
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { API_URL } from "@/constants/api";

export type Role = "super_admin" | "inventory_manager" | "distributor";
export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: Role;
}

// Re-auth timeout: 30 days. After this period without a successful online
// login, the user must re-authenticate even if offline. The token itself
// is also 30 days on the server, so this aligns with server expiry.
const REAUTH_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;
const LAST_ONLINE_AUTH_KEY = "lastOnlineAuthAt";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Returns true if the user needs to re-authenticate (timeout exceeded). */
  needsReauth: () => Promise<boolean>;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  hydrate: async () => {
    const token = await AsyncStorage.getItem("authToken");
    const raw = await AsyncStorage.getItem("authUser");
    set({ token, user: raw ? JSON.parse(raw) : null, hydrated: true });
  },
  login: async (username, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || "Login failed");
    }
    const data = await res.json();
    await AsyncStorage.setItem("authToken", data.token);
    await AsyncStorage.setItem("authUser", JSON.stringify(data.user));
    // Record the time of the last successful online authentication.
    await AsyncStorage.setItem(LAST_ONLINE_AUTH_KEY, new Date().toISOString());
    set({ token: data.token, user: data.user });
  },
  logout: async () => {
    await AsyncStorage.removeItem("authToken");
    await AsyncStorage.removeItem("authUser");
    await AsyncStorage.removeItem(LAST_ONLINE_AUTH_KEY);
    set({ token: null, user: null });
  },
  needsReauth: async () => {
    const raw = await AsyncStorage.getItem(LAST_ONLINE_AUTH_KEY);
    if (!raw) return true; // Never authenticated online.
    const lastAuth = new Date(raw).getTime();
    return Date.now() - lastAuth > REAUTH_TIMEOUT_MS;
  },
}));

/**
 * Read the current auth session (token + user) from outside React components.
 * Non-hook accessor over the zustand store — safe to call in plain functions,
 * effects, and utility libs where hooks can't be used.
 */
export function getAuth(): { token: string | null; user: AuthUser | null } {
  const { token, user } = useAuth.getState();
  return { token, user };
}

/**
 * Read the stored JWT. Used by non-hook code (upload lib, offline queue).
 */
export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("authToken");
}

/**
 * Clear the local session (used when the server rejects the token as
 * expired/invalid). Screens observe `useAuth().user` and redirect to /login.
 */
async function clearSession() {
  await AsyncStorage.removeItem("authToken");
  await AsyncStorage.removeItem("authUser");
  await AsyncStorage.removeItem(LAST_ONLINE_AUTH_KEY);
  useAuth.setState({ token: null, user: null });
}

export async function authFetch(path: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem("authToken");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    // Expired / invalid / missing token: clear the session so the app falls
    // back to the login screen gracefully instead of showing broken state.
    if (res.status === 401) {
      await clearSession();
      throw new Error("Your session has expired. Please sign in again.");
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export const roleLabel: Record<Role, string> = {
  super_admin: "Super Admin",
  inventory_manager: "Inventory Manager",
  distributor: "Distributor",
};

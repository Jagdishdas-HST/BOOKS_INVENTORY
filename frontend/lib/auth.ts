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

const REAUTH_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;
const LAST_ONLINE_AUTH_KEY = "lastOnlineAuthAt";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
    if (!raw) return true;
    const lastAuth = new Date(raw).getTime();
    return Date.now() - lastAuth > REAUTH_TIMEOUT_MS;
  },
}));

export function getAuth(): { token: string | null; user: AuthUser | null } {
  const { token, user } = useAuth.getState();
  return { token, user };
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("authToken");
}

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
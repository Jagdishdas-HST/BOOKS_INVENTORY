
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

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || "Login failed");
    }
    const data = await res.json();
    await AsyncStorage.setItem("authToken", data.token);
    await AsyncStorage.setItem("authUser", JSON.stringify(data.user));
    set({ token: data.token, user: data.user });
  },
  logout: async () => {
    await AsyncStorage.removeItem("authToken");
    await AsyncStorage.removeItem("authUser");
    set({ token: null, user: null });
  },
}));

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

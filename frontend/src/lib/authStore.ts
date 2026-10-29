import { create } from "zustand";

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
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  login: (token, user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("authToken", token);
      localStorage.setItem("authUser", JSON.stringify(user));
    }
    set({ token, user });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUser");
    }
    set({ token: null, user: null });
  },
}));

// Hydrate from localStorage on the client after mount (SSR-safe)
if (typeof window !== "undefined") {
  try {
    const token = localStorage.getItem("authToken");
    const raw = localStorage.getItem("authUser");
    if (token) {
      useAuthStore.setState({ token, user: raw ? JSON.parse(raw) : null });
    }
  } catch {
    // ignore
  }
}
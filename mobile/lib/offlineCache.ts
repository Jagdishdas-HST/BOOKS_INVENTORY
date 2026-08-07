
/**
 * Offline cache for distributor-facing data.
 *
 * Stores:
 *   - held stock (distributorStock holdings)
 *   - outstanding balance summary
 *   - book catalog (read-only reference)
 *
 * Each entry is stamped with a `cachedAt` ISO timestamp so the UI can show
 * "as of [time]" banners, making it unambiguous that the data is cached.
 *
 * All reads are synchronous (from in-memory state after hydration); writes
 * go to AsyncStorage for persistence across restarts.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  holdings: "cache:holdings",
  balance: "cache:balance",
  catalog: "cache:catalog",
};

export interface CachedEntry<T> {
  data: T;
  cachedAt: string; // ISO timestamp
}

// ── Holdings ──────────────────────────────────────────────────────────────

export type HoldingItem = {
  id: number;
  bookId: number;
  title: string;
  category: string;
  language: string;
  quantity: number;
  retailPrice: string;
  isbn?: string | null;
  coverUrl?: string | null;
};

export async function saveHoldingsCache(data: HoldingItem[]) {
  const entry: CachedEntry<HoldingItem[]> = { data, cachedAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEYS.holdings, JSON.stringify(entry));
}

export async function loadHoldingsCache(): Promise<CachedEntry<HoldingItem[]> | null> {
  const raw = await AsyncStorage.getItem(KEYS.holdings);
  return raw ? JSON.parse(raw) : null;
}

// ── Balance ───────────────────────────────────────────────────────────────

export type BalanceSummary = {
  debtTotal: number;
  remittedTotal: number;
  outstanding: number;
  cashTotal: number;
  onlineTotal: number;
  freeCopies: number;
  discountedTotal: number;
};

export async function saveBalanceCache(data: BalanceSummary) {
  const entry: CachedEntry<BalanceSummary> = { data, cachedAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEYS.balance, JSON.stringify(entry));
}

export async function loadBalanceCache(): Promise<CachedEntry<BalanceSummary> | null> {
  const raw = await AsyncStorage.getItem(KEYS.balance);
  return raw ? JSON.parse(raw) : null;
}

// ── Catalog ───────────────────────────────────────────────────────────────

export type CatalogBook = {
  id: number;
  sku: string;
  title: string;
  category: string;
  language: string;
  retailPrice: string;
  costPrice: string;
  warehouseStock: number;
  reorderThreshold: number;
  isbn?: string | null;
  coverUrl?: string | null;
  active: boolean;
};

export async function saveCatalogCache(data: CatalogBook[]) {
  const entry: CachedEntry<CatalogBook[]> = { data, cachedAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEYS.catalog, JSON.stringify(entry));
}

export async function loadCatalogCache(): Promise<CachedEntry<CatalogBook[]> | null> {
  const raw = await AsyncStorage.getItem(KEYS.catalog);
  return raw ? JSON.parse(raw) : null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Format a cachedAt ISO string for display: "as of 14 Jan, 3:42 PM"
 */
export function formatCacheTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

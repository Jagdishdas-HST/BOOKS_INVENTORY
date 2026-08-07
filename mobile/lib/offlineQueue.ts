
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { API_URL } from "@/constants/api";

const QUEUE_KEY = "offlineSaleQueue";

export type QueueStatus = "pending" | "syncing" | "conflict";

export interface QueuedSale {
  clientId: string;
  bookId: number;
  bookTitle: string;
  quantity: number;
  unitPrice: number;
  paymentType: "cash" | "online" | "debt" | "free";
  totalValue: number;
  clientLoggedAt: string; // field-time ISO timestamp
  status: QueueStatus;
  conflictId?: number;
  error?: string;
}

async function readQueue(): Promise<QueuedSale[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function writeQueue(items: QueuedSale[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface QueueState {
  items: QueuedSale[];
  syncing: boolean;
  refresh: () => Promise<void>;
  enqueue: (item: Omit<QueuedSale, "clientId" | "status" | "clientLoggedAt">) => Promise<QueuedSale>;
  sync: () => Promise<void>;
}

async function checkOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const useOfflineQueue = create<QueueState>((set, get) => ({
  items: [],
  syncing: false,
  refresh: async () => {
    set({ items: await readQueue() });
  },
  enqueue: async (item) => {
    const q = await readQueue();
    const entry: QueuedSale = {
      ...item,
      clientId: genId(),
      status: "pending",
      clientLoggedAt: new Date().toISOString(),
    };
    const next = [...q, entry];
    await writeQueue(next);
    set({ items: next });
    // Fire-and-forget a sync attempt.
    get().sync();
    return entry;
  },
  sync: async () => {
    if (get().syncing) return;
    set({ syncing: true });
    try {
      const online = await checkOnline();
      if (!online) return;

      let queue = await readQueue();
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      const survivors: QueuedSale[] = [];
      for (const q of queue) {
        // Mark as syncing in memory (not persisted — transient UI state)
        set((s) => ({
          items: s.items.map((i) =>
            i.clientId === q.clientId ? { ...i, status: "syncing" } : i
          ),
        }));

        try {
          const res = await fetch(`${API_URL}/api/sales`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              bookId: q.bookId,
              quantity: q.quantity,
              unitPrice: q.unitPrice,
              paymentType: q.paymentType,
              clientLoggedAt: q.clientLoggedAt,
              clientId: q.clientId,
            }),
          });
          const data = await res.json().catch(() => ({}));

          if (res.status === 201 || data?.status === "created" || data?.status === "duplicate") {
            // Synced successfully (or already present) — drop from queue.
            continue;
          }
          if (res.status === 409 || data?.status === "conflict") {
            // Flagged for admin review — keep visible locally as a conflict.
            survivors.push({ ...q, status: "conflict", conflictId: data?.conflict?.id });
            continue;
          }
          // Unknown non-fatal failure — keep pending to retry.
          survivors.push({ ...q, status: "pending", error: data?.error?.message });
        } catch {
          // Network dropped mid-sync — keep pending.
          survivors.push({ ...q, status: "pending" });
        }
      }

      await writeQueue(survivors);
      set({ items: survivors });
    } finally {
      set({ syncing: false });
    }
  },
}));

export function newClientId() {
  return genId();
}

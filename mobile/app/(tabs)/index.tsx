
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  Plus, HandCoins, Boxes, Users, ChevronRight, TrendingUp,
  ShieldCheck, BarChart3, AlertTriangle, Undo2, ClipboardCheck,
  GitPullRequestArrow,
} from "lucide-react-native";
import { useAuth, authFetch, roleLabel } from "@/lib/auth";
import { StatCard, Skeleton, EmptyState } from "@/components/ui";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useIsOnline, startConnectivityPolling } from "@/lib/connectivity";
import {
  saveHoldingsCache, loadHoldingsCache,
  saveBalanceCache, loadBalanceCache,
  type HoldingItem, type BalanceSummary,
} from "@/lib/offlineCache";
import { useOfflineQueue } from "@/lib/offlineQueue";

export default function Home() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const online = useIsOnline();

  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [balanceCachedAt, setBalanceCachedAt] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [holdingsCachedAt, setHoldingsCachedAt] = useState<string | null>(null);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [conflictCount, setConflictCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const syncQueue = useOfflineQueue((s) => s.sync);
  const refreshQueue = useOfflineQueue((s) => s.refresh);

  const isDistributor = user?.role === "distributor";
  const isSuperAdmin = user?.role === "super_admin";
  const isManagerOrAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";

  useEffect(() => {
    startConnectivityPolling();
  }, []);

  useEffect(() => { if (!hydrated) hydrate(); }, [hydrated]);
  useEffect(() => { if (hydrated && !user) router.replace("/login"); }, [hydrated, user]);

  // Load cached data immediately on mount (before network).
  useEffect(() => {
    if (!user || !isDistributor) return;
    Promise.all([loadHoldingsCache(), loadBalanceCache()]).then(([h, b]) => {
      if (h) { setHoldings(h.data); setHoldingsCachedAt(h.cachedAt); }
      if (b) { setBalance(b.data); setBalanceCachedAt(b.cachedAt); }
    });
  }, [user, isDistributor]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      if (isDistributor) {
        if (online) {
          const [b, h] = await Promise.all([
            authFetch("/api/sales/balance"),
            authFetch("/api/stock/holdings"),
          ]);
          setBalance(b);
          setBalanceCachedAt(new Date().toISOString());
          setHoldings(h);
          setHoldingsCachedAt(new Date().toISOString());
          // Persist to cache for offline use.
          await saveBalanceCache(b);
          await saveHoldingsCache(h);
        }
        // If offline, cached data is already loaded from the useEffect above.
      } else {
        if (online) {
          const [d, ls, cc] = await Promise.all([
            authFetch("/api/users/distributors"),
            authFetch("/api/stock/low-stock"),
            authFetch("/api/conflicts/pending-count").catch(() => ({ count: 0 })),
          ]);
          setDistributors(d);
          setLowStock(ls);
          setConflictCount(cc?.count ?? 0);
        }
      }
    } catch {}
    setLoading(false);
  }, [user, isDistributor, online]);

  useEffect(() => {
    if (user) {
      load();
      if (isDistributor) {
        refreshQueue();
        syncQueue();
      }
    }
  }, [user, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    if (isDistributor) {
      await syncQueue();
      await refreshQueue();
    }
    setRefreshing(false);
  };

  if (!user) return null;
  const totalStock = holdings.reduce((a, h) => a + h.quantity, 0);

  // Use the most recent cachedAt between balance and holdings.
  const dataCachedAt = balanceCachedAt || holdingsCachedAt;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-3xl"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}
      >
        <View className="px-lg pt-md pb-lg">
          <Text className="text-stone-500 text-sm">{roleLabel[user.role]}</Text>
          <Text className="text-stone-900 text-2xl font-extrabold">
            Hare Krishna, {user.name.split(" ")[0]}
          </Text>
        </View>

        {/* Offline banner — shown for all roles */}
        <OfflineBanner
          cachedAt={isDistributor ? dataCachedAt : undefined}
          label={
            isDistributor
              ? "Offline — showing last synced data"
              : "Offline — some data may be outdated"
          }
        />

        {isDistributor ? (
          <>
            <View className="mx-lg rounded-2xl bg-amber-600 p-xl">
              <Text className="text-amber-100 text-xs tracking-wider">OUTSTANDING BALANCE</Text>
              <Text className="text-white text-4xl font-extrabold mt-xs">
                ₹{loading && !balance ? "—" : (balance?.outstanding ?? 0).toLocaleString("en-IN")}
              </Text>
              {!online && dataCachedAt ? (
                <Text className="text-amber-200 text-xs mt-xs">
                  as of {new Date(dataCachedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                </Text>
              ) : null}
              <View className="flex-row mt-lg pt-md border-t border-amber-400/40 gap-lg">
                <View>
                  <Text className="text-amber-100 text-xs">DEBT SALES</Text>
                  <Text className="text-white font-bold">₹{(balance?.debtTotal ?? 0).toLocaleString("en-IN")}</Text>
                </View>
                <View>
                  <Text className="text-amber-100 text-xs">REMITTED</Text>
                  <Text className="text-white font-bold">₹{(balance?.remittedTotal ?? 0).toLocaleString("en-IN")}</Text>
                </View>
              </View>
            </View>

            <View className="flex-row px-lg mt-lg gap-sm">
              <StatCard label="Books held" value={String(totalStock)} />
              <StatCard label="Cash sales" value={`₹${(balance?.cashTotal ?? 0).toLocaleString("en-IN")}`} tone="success" />
            </View>

            <View className="px-lg mt-xl">
              <Text className="text-stone-900 text-lg font-bold mb-sm">Quick Actions</Text>
              <View className="flex-row gap-sm">
                <Pressable
                  onPress={() => router.push("/sale/new")}
                  accessibilityLabel="Log a sale"
                  className="flex-1 flex-row items-center justify-center gap-xs rounded-xl bg-amber-600 py-md active:opacity-80"
                >
                  <Plus size={16} color="#fff" />
                  <Text className="text-white font-semibold">Log Sale</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!online) return;
                    router.push("/remittance/new");
                  }}
                  accessibilityLabel="Log a remittance"
                  className={`flex-1 flex-row items-center justify-center gap-xs rounded-xl py-md ${online ? "bg-stone-200 active:opacity-70" : "bg-stone-100"}`}
                >
                  <HandCoins size={16} color={online ? "#292524" : "#a8a29e"} />
                  <Text className={`font-semibold ${online ? "text-stone-900" : "text-stone-400"}`}>Remit</Text>
                </Pressable>
              </View>
            </View>

            <View className="px-lg mt-xl">
              <Text className="text-stone-900 text-lg font-bold mb-sm">My Stock on Hand</Text>
              {loading && holdings.length === 0 ? (
                <Skeleton />
              ) : holdings.length === 0 ? (
                <View className="rounded-xl bg-white border border-stone-200">
                  <EmptyState
                    icon={<Boxes size={26} color="#a8a29e" />}
                    title="No stock assigned yet"
                    description="Your manager will assign books to you soon."
                  />
                </View>
              ) : (
                <View className="gap-sm">
                  {holdings.map((h) => (
                    <View key={h.id} className="flex-row items-center justify-between rounded-xl bg-white border border-stone-200 p-md">
                      <View className="flex-1">
                        <Text className="text-stone-900 font-semibold" numberOfLines={1}>{h.title}</Text>
                        <Text className="text-stone-500 text-xs">{h.category} · {h.language}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-amber-700 font-extrabold text-lg">{h.quantity}</Text>
                        <Text className="text-stone-400 text-xs">copies</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : (
          <>
            {!loading && lowStock.length > 0 && (
              <View className="mx-lg mb-md rounded-xl bg-rose-50 border border-rose-200 p-md">
                <View className="flex-row items-center gap-xs mb-xs">
                  <AlertTriangle size={18} color="#e11d48" />
                  <Text className="text-rose-700 font-bold">
                    {lowStock.length} title{lowStock.length === 1 ? "" : "s"} low on stock
                  </Text>
                </View>
                <View className="gap-xs mt-xs">
                  {lowStock.slice(0, 4).map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => router.push({ pathname: "/book/[id]", params: { id: String(b.id) } })}
                      className="flex-row items-center justify-between active:opacity-70"
                    >
                      <Text className="text-stone-800 text-sm flex-1" numberOfLines={1}>{b.title}</Text>
                      <Text className="text-rose-700 text-sm font-semibold ml-sm">
                        {b.warehouseStock} left · reorder ≤{b.reorderThreshold}
                      </Text>
                    </Pressable>
                  ))}
                  {lowStock.length > 4 && (
                    <Text className="text-rose-600 text-xs mt-xs">+{lowStock.length - 4} more below threshold</Text>
                  )}
                </View>
              </View>
            )}

            {!loading && conflictCount > 0 && (
              <View className="px-lg mb-md">
                <Pressable
                  onPress={() => router.push("/conflicts")}
                  accessibilityLabel="Review sync conflicts"
                  className="flex-row items-center justify-between rounded-xl bg-rose-600 p-md active:opacity-80"
                >
                  <View className="flex-row items-center gap-sm">
                    <View className="w-9 h-9 rounded-full bg-rose-500 items-center justify-center">
                      <GitPullRequestArrow size={18} color="#fff" />
                    </View>
                    <View>
                      <Text className="text-white font-semibold">
                        {conflictCount} sale{conflictCount === 1 ? "" : "s"} need review
                      </Text>
                      <Text className="text-rose-100 text-xs">Offline sales that failed a stock re-check</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#fecdd3" />
                </Pressable>
              </View>
            )}

            <View className="px-lg">
              <View className="flex-row gap-sm">
                <Pressable
                  onPress={() => { if (online) router.push("/stock/assign"); }}
                  accessibilityLabel="Assign stock"
                  className={`flex-1 flex-row items-center justify-center gap-xs rounded-xl py-md ${online ? "bg-amber-600 active:opacity-80" : "bg-stone-200"}`}
                >
                  <Boxes size={16} color={online ? "#fff" : "#a8a29e"} />
                  <Text className={`font-semibold ${online ? "text-white" : "text-stone-400"}`}>Assign Stock</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/(tabs)/catalog")}
                  accessibilityLabel="Manage catalog"
                  className="flex-1 flex-row items-center justify-center gap-xs rounded-xl bg-stone-200 py-md active:opacity-70"
                >
                  <TrendingUp size={16} color="#292524" />
                  <Text className="text-stone-900 font-semibold">Catalog</Text>
                </Pressable>
              </View>
              <View className="flex-row gap-sm mt-sm">
                <Pressable
                  onPress={() => { if (online) router.push("/stock/return"); }}
                  accessibilityLabel="Return stock"
                  className={`flex-1 flex-row items-center justify-center gap-xs rounded-xl py-md ${online ? "bg-stone-200 active:opacity-70" : "bg-stone-100"}`}
                >
                  <Undo2 size={16} color={online ? "#292524" : "#a8a29e"} />
                  <Text className={`font-semibold ${online ? "text-stone-900" : "text-stone-400"}`}>Return Stock</Text>
                </Pressable>
                <Pressable
                  onPress={() => { if (online) router.push("/stock/reconcile"); }}
                  accessibilityLabel="Reconcile stock"
                  className={`flex-1 flex-row items-center justify-center gap-xs rounded-xl py-md ${online ? "bg-stone-200 active:opacity-70" : "bg-stone-100"}`}
                >
                  <ClipboardCheck size={16} color={online ? "#292524" : "#a8a29e"} />
                  <Text className={`font-semibold ${online ? "text-stone-900" : "text-stone-400"}`}>Reconcile</Text>
                </Pressable>
              </View>
            </View>

            {isManagerOrAdmin && (
              <View className="px-lg mt-md">
                <Pressable
                  onPress={() => { if (online) router.push("/reports"); }}
                  accessibilityLabel="View reports"
                  className={`flex-row items-center justify-between rounded-xl border p-md ${online ? "bg-amber-50 border-amber-200 active:opacity-80" : "bg-stone-50 border-stone-200"}`}
                >
                  <View className="flex-row items-center gap-sm">
                    <View className={`w-9 h-9 rounded-full items-center justify-center ${online ? "bg-amber-600" : "bg-stone-300"}`}>
                      <BarChart3 size={18} color="#fff" />
                    </View>
                    <View>
                      <Text className="text-stone-900 font-semibold">Reports & Analytics</Text>
                      <Text className="text-stone-500 text-xs">
                        {online ? "Sales, leaderboard & top titles" : "Requires connection"}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={online ? "#d97706" : "#a8a29e"} />
                </Pressable>
              </View>
            )}

            {isManagerOrAdmin && (
              <View className="px-lg mt-md">
                <Pressable
                  onPress={() => router.push("/conflicts")}
                  accessibilityLabel="Sync conflicts"
                  className="flex-row items-center justify-between rounded-xl bg-white border border-stone-200 p-md active:opacity-80"
                >
                  <View className="flex-row items-center gap-sm">
                    <View className="w-9 h-9 rounded-full bg-rose-100 items-center justify-center">
                      <GitPullRequestArrow size={18} color="#e11d48" />
                    </View>
                    <View>
                      <Text className="text-stone-900 font-semibold">Sync Conflicts</Text>
                      <Text className="text-stone-500 text-xs">Review flagged offline sales</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#a8a29e" />
                </Pressable>
              </View>
            )}

            {isSuperAdmin && (
              <View className="px-lg mt-md">
                <Pressable
                  onPress={() => { if (online) router.push("/audit"); }}
                  accessibilityLabel="View audit log"
                  className={`flex-row items-center justify-between rounded-xl p-md ${online ? "bg-stone-900 active:opacity-80" : "bg-stone-700"}`}
                >
                  <View className="flex-row items-center gap-sm">
                    <View className="w-9 h-9 rounded-full bg-stone-700 items-center justify-center">
                      <ShieldCheck size={18} color="#fbbf24" />
                    </View>
                    <View>
                      <Text className="text-white font-semibold">Audit Log</Text>
                      <Text className="text-stone-400 text-xs">
                        {online ? "Append-only system activity" : "Requires connection"}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#a8a29e" />
                </Pressable>
              </View>
            )}

            <View className="px-lg mt-xl">
              <View className="flex-row items-center gap-xs mb-sm">
                <Users size={18} color="#292524" />
                <Text className="text-stone-900 text-lg font-bold">Distributors</Text>
              </View>
              {loading ? (
                <Skeleton />
              ) : !online && distributors.length === 0 ? (
                <View className="rounded-xl bg-white border border-stone-200">
                  <EmptyState
                    icon={<Users size={26} color="#a8a29e" />}
                    title="Offline"
                    description="Distributor list requires a connection."
                  />
                </View>
              ) : distributors.length === 0 ? (
                <View className="rounded-xl bg-white border border-stone-200">
                  <EmptyState
                    icon={<Users size={26} color="#a8a29e" />}
                    title="No distributors"
                    description="Create distributor accounts from Profile."
                  />
                </View>
              ) : (
                <View className="gap-sm">
                  {distributors.map((d) => (
                    <Pressable
                      key={d.id}
                      onPress={() => router.push({ pathname: "/distributor/[id]", params: { id: String(d.id), name: d.name } })}
                      className="flex-row items-center justify-between rounded-xl bg-white border border-stone-200 p-md active:opacity-80"
                    >
                      <View className="flex-row items-center gap-sm flex-1">
                        <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center">
                          <Text className="text-amber-700 font-bold">{d.name[0]}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-stone-900 font-semibold">{d.name}</Text>
                          <Text className="text-stone-500 text-xs">@{d.username}{!d.active ? " · inactive" : ""}</Text>
                        </View>
                      </View>
                      <ChevronRight size={18} color="#a8a29e" />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

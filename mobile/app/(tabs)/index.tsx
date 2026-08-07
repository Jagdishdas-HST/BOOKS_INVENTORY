
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  Plus, HandCoins, Boxes, Users, ChevronRight, TrendingUp,
  ShieldCheck, BarChart3, AlertTriangle, Undo2, ClipboardCheck,
  GitPullRequestArrow, ArrowUpRight, BookOpen, Activity,
  Banknote, Target, Zap,
} from "lucide-react-native";
import { useAuth, authFetch, roleLabel } from "@/lib/auth";
import { Skeleton, EmptyState } from "@/components/ui";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useIsOnline, startConnectivityPolling } from "@/lib/connectivity";
import {
  saveHoldingsCache, loadHoldingsCache,
  saveBalanceCache, loadBalanceCache,
  type HoldingItem, type BalanceSummary,
} from "@/lib/offlineCache";
import { useOfflineQueue } from "@/lib/offlineQueue";

const C = {
  amber: "#f59e0b",
  amberDark: "#d97706",
  emerald: "#10b981",
  rose: "#f43f5e",
  blue: "#3b82f6",
  navy: "#0f172a",
  navyMid: "#1e293b",
  slate: "#475569",
  muted: "#94a3b8",
};

function QuickAction({ label, icon, onPress, disabled, accent = false }: {
  label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean; accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      className={`flex-1 items-center justify-center rounded-2xl py-md gap-xs ${accent ? "bg-amber-500" : disabled ? "bg-slate-100" : "bg-white border border-slate-200"} active:opacity-80`}
      style={!accent && !disabled ? { shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 } : {}}>
      {icon}
      <Text className={`text-xs font-bold ${accent ? "text-white" : disabled ? "text-slate-400" : "text-slate-700"}`}>{label}</Text>
    </Pressable>
  );
}

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
  const [monthSummary, setMonthSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const syncQueue = useOfflineQueue((s) => s.sync);
  const refreshQueue = useOfflineQueue((s) => s.refresh);

  const isDistributor = user?.role === "distributor";
  const isSuperAdmin = user?.role === "super_admin";
  const isManagerOrAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";

  useEffect(() => { startConnectivityPolling(); }, []);
  useEffect(() => { if (!hydrated) hydrate(); }, [hydrated]);
  useEffect(() => { if (hydrated && !user) router.replace("/login"); }, [hydrated, user]);

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
          await saveBalanceCache(b);
          await saveHoldingsCache(h);
        }
      } else {
        if (online) {
          const [d, ls, cc, ms] = await Promise.all([
            authFetch("/api/users/distributors"),
            authFetch("/api/stock/low-stock"),
            authFetch("/api/conflicts/pending-count").catch(() => ({ count: 0 })),
            authFetch("/api/reports?range=month").catch(() => null),
          ]);
          setDistributors(d);
          setLowStock(ls);
          setConflictCount(cc?.count ?? 0);
          setMonthSummary(ms?.summary ?? null);
        }
      }
    } catch {}
    setLoading(false);
  }, [user, isDistributor, online]);

  useEffect(() => {
    if (user) {
      load();
      if (isDistributor) { refreshQueue(); syncQueue(); }
    }
  }, [user, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    if (isDistributor) { await syncQueue(); await refreshQueue(); }
    setRefreshing(false);
  };

  if (!user) return null;
  const totalStock = holdings.reduce((a, h) => a + h.quantity, 0);
  const dataCachedAt = balanceCachedAt || holdingsCachedAt;
  const inr = (n: number) => `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;
  const inrK = (n: number) => {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${Math.round(n)}`;
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-slate-50">
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-3xl"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.amberDark} />}
      >
        {/* ── Header ── */}
        <View className="px-lg pt-md pb-lg bg-white border-b border-slate-100"
          style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{roleLabel[user.role]}</Text>
              <Text className="text-slate-900 text-2xl font-extrabold mt-xs">
                Welcome, {user.name.split(" ")[0]}
              </Text>
            </View>
            <View className="w-11 h-11 rounded-2xl items-center justify-center"
              style={{ backgroundColor: C.navy }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{user.name[0]}</Text>
            </View>
          </View>
        </View>

        <OfflineBanner
          cachedAt={isDistributor ? dataCachedAt : undefined}
          label={isDistributor ? "Offline — showing last synced data" : "Offline — some data may be outdated"}
        />

        {isDistributor ? (
          <>
            {/* ── Balance Hero ── */}
            <View className="mx-lg mt-lg rounded-3xl overflow-hidden"
              style={{ backgroundColor: C.navy, shadowColor: C.navy, shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
              <View className="p-xl">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-xs mb-xs">
                      <View className="w-2 h-2 rounded-full bg-rose-400" />
                      <Text style={{ color: "#94a3b8", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" }}>
                        Outstanding Balance
                      </Text>
                    </View>
                    <Text style={{ color: "#fff", fontSize: 38, fontWeight: "800", lineHeight: 44 }}>
                      {loading && !balance ? "—" : inr(balance?.outstanding ?? 0)}
                    </Text>
                    {!online && dataCachedAt ? (
                      <Text style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>
                        as of {new Date(dataCachedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ backgroundColor: "#f43f5e22", borderRadius: 16, padding: 10 }}>
                    <Target size={22} color={C.rose} />
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: "#1e293b", marginVertical: 16 }} />

                <View className="flex-row gap-xl">
                  <View>
                    <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Debt Sales</Text>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 2 }}>{inrK(balance?.debtTotal ?? 0)}</Text>
                  </View>
                  <View>
                    <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Remitted</Text>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 2 }}>{inrK(balance?.remittedTotal ?? 0)}</Text>
                  </View>
                  <View>
                    <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Cash</Text>
                    <Text style={{ color: C.emerald, fontSize: 20, fontWeight: "800", marginTop: 2 }}>{inrK(balance?.cashTotal ?? 0)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Stock Summary ── */}
            <View className="flex-row px-lg mt-md gap-sm">
              <View className="flex-1 rounded-2xl bg-white border border-slate-100 p-md"
                style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                <View className="w-8 h-8 rounded-xl bg-blue-100 items-center justify-center mb-sm">
                  <Boxes size={16} color={C.blue} />
                </View>
                <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Books Held</Text>
                <Text className="text-slate-900 text-2xl font-extrabold mt-xs">{totalStock}</Text>
                <Text className="text-slate-400 text-xs mt-xs">copies on hand</Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white border border-slate-100 p-md"
                style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                <View className="w-8 h-8 rounded-xl bg-emerald-100 items-center justify-center mb-sm">
                  <Banknote size={16} color={C.emerald} />
                </View>
                <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Cash Sales</Text>
                <Text className="text-emerald-600 text-2xl font-extrabold mt-xs">{inrK(balance?.cashTotal ?? 0)}</Text>
                <Text className="text-slate-400 text-xs mt-xs">collected</Text>
              </View>
            </View>

            {/* ── Quick Actions ── */}
            <View className="px-lg mt-lg">
              <Text className="text-slate-900 text-base font-extrabold mb-md">Quick Actions</Text>
              <View className="flex-row gap-sm">
                <QuickAction
                  label="Log Sale"
                  icon={<Plus size={20} color="#fff" />}
                  onPress={() => router.push("/sale/new")}
                  accent
                />
                <QuickAction
                  label="Remit"
                  icon={<HandCoins size={20} color={online ? C.slate : C.muted} />}
                  onPress={() => { if (!online) return; router.push("/remittance/new"); }}
                  disabled={!online}
                />
              </View>
            </View>

            {/* ── Stock on Hand ── */}
            <View className="px-lg mt-xl">
              <Text className="text-slate-900 text-base font-extrabold mb-md">My Stock on Hand</Text>
              {loading && holdings.length === 0 ? (
                <Skeleton />
              ) : holdings.length === 0 ? (
                <View className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                  <EmptyState icon={<Boxes size={26} color="#94a3b8" />} title="No stock assigned yet"
                    description="Your manager will assign books to you soon." />
                </View>
              ) : (
                <View className="gap-sm">
                  {holdings.map((h) => (
                    <View key={h.id} className="flex-row items-center justify-between rounded-2xl bg-white border border-slate-100 p-md"
                      style={{ shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}>
                      <View className="w-10 h-10 rounded-xl bg-amber-100 items-center justify-center mr-sm">
                        <BookOpen size={18} color={C.amberDark} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-slate-900 font-semibold" numberOfLines={1}>{h.title}</Text>
                        <Text className="text-slate-500 text-xs">{h.category} · {h.language}</Text>
                      </View>
                      <View className="items-end">
                        <Text style={{ color: C.amberDark, fontWeight: "800", fontSize: 20 }}>{h.quantity}</Text>
                        <Text className="text-slate-400 text-xs">copies</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : (
          <>
            {/* ── This Month Summary ── */}
            {isManagerOrAdmin && monthSummary && (
              <View className="mx-lg mt-lg rounded-3xl overflow-hidden"
                style={{ backgroundColor: C.navy, shadowColor: C.navy, shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
                <View className="p-xl">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-xs mb-xs">
                        <View className="w-2 h-2 rounded-full bg-amber-400" />
                        <Text style={{ color: "#94a3b8", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" }}>
                          This Month
                        </Text>
                      </View>
                      <Text style={{ color: "#fff", fontSize: 36, fontWeight: "800", lineHeight: 42 }}>
                        {inr(monthSummary.totalSalesValue)}
                      </Text>
                    </View>
                    <Pressable onPress={() => router.push("/reports")} accessibilityLabel="View full reports"
                      className="flex-row items-center gap-xs rounded-full px-md py-sm active:opacity-80"
                      style={{ backgroundColor: "#f59e0b22" }}>
                      <BarChart3 size={14} color={C.amber} />
                      <Text style={{ color: C.amber, fontSize: 12, fontWeight: "700" }}>Analytics</Text>
                    </Pressable>
                  </View>

                  <View style={{ height: 1, backgroundColor: "#1e293b", marginVertical: 16 }} />

                  <View className="flex-row gap-xl">
                    <View>
                      <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Copies</Text>
                      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 2 }}>{monthSummary.totalCopies.toLocaleString("en-IN")}</Text>
                    </View>
                    <View>
                      <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Cash</Text>
                      <Text style={{ color: C.emerald, fontSize: 18, fontWeight: "800", marginTop: 2 }}>{inrK(monthSummary.cashTotal)}</Text>
                    </View>
                    <View>
                      <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Outstanding</Text>
                      <Text style={{ color: C.rose, fontSize: 18, fontWeight: "800", marginTop: 2 }}>{inrK(monthSummary.outstanding)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ── Alerts ── */}
            {!loading && lowStock.length > 0 && (
              <View className="mx-lg mt-md rounded-2xl bg-rose-50 border border-rose-200 p-md"
                style={{ shadowColor: C.rose, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                <View className="flex-row items-center gap-sm mb-sm">
                  <View className="w-8 h-8 rounded-xl bg-rose-100 items-center justify-center">
                    <AlertTriangle size={16} color={C.rose} />
                  </View>
                  <Text className="text-rose-700 font-bold">
                    {lowStock.length} title{lowStock.length === 1 ? "" : "s"} low on stock
                  </Text>
                </View>
                <View className="gap-xs">
                  {lowStock.slice(0, 4).map((b) => (
                    <Pressable key={b.id}
                      onPress={() => router.push({ pathname: "/book/[id]", params: { id: String(b.id) } })}
                      className="flex-row items-center justify-between py-xs active:opacity-70">
                      <Text className="text-slate-800 text-sm flex-1 font-medium" numberOfLines={1}>{b.title}</Text>
                      <Text className="text-rose-600 text-sm font-bold ml-sm">
                        {b.warehouseStock} left
                      </Text>
                    </Pressable>
                  ))}
                  {lowStock.length > 4 && (
                    <Text className="text-rose-500 text-xs font-medium mt-xs">+{lowStock.length - 4} more below threshold</Text>
                  )}
                </View>
              </View>
            )}

            {!loading && conflictCount > 0 && (
              <View className="px-lg mt-md">
                <Pressable onPress={() => router.push("/conflicts")} accessibilityLabel="Review sync conflicts"
                  className="flex-row items-center justify-between rounded-2xl p-md active:opacity-80"
                  style={{ backgroundColor: C.rose, shadowColor: C.rose, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
                  <View className="flex-row items-center gap-sm">
                    <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: "#ffffff22" }}>
                      <GitPullRequestArrow size={18} color="#fff" />
                    </View>
                    <View>
                      <Text className="text-white font-bold">
                        {conflictCount} sale{conflictCount === 1 ? "" : "s"} need review
                      </Text>
                      <Text style={{ color: "#fecdd3", fontSize: 12 }}>Offline sales that failed a stock re-check</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#fecdd3" />
                </Pressable>
              </View>
            )}

            {/* ── Quick Actions Grid ── */}
            <View className="px-lg mt-lg">
              <Text className="text-slate-900 text-base font-extrabold mb-md">Quick Actions</Text>
              <View className="flex-row gap-sm mb-sm">
                <QuickAction
                  label="Assign Stock"
                  icon={<Boxes size={20} color={online ? "#fff" : C.muted} />}
                  onPress={() => { if (online) router.push("/stock/assign"); }}
                  disabled={!online}
                  accent={online}
                />
                <QuickAction
                  label="Catalog"
                  icon={<BookOpen size={20} color={C.slate} />}
                  onPress={() => router.push("/(tabs)/catalog")}
                />
              </View>
              <View className="flex-row gap-sm">
                <QuickAction
                  label="Return Stock"
                  icon={<Undo2 size={20} color={online ? C.slate : C.muted} />}
                  onPress={() => { if (online) router.push("/stock/return"); }}
                  disabled={!online}
                />
                <QuickAction
                  label="Reconcile"
                  icon={<ClipboardCheck size={20} color={online ? C.slate : C.muted} />}
                  onPress={() => { if (online) router.push("/stock/reconcile"); }}
                  disabled={!online}
                />
              </View>
            </View>

            {/* ── Analytics Card ── */}
            {isManagerOrAdmin && (
              <View className="px-lg mt-md">
                <Pressable onPress={() => { if (online) router.push("/reports"); }}
                  accessibilityLabel="View analytics"
                  className="rounded-2xl overflow-hidden active:opacity-90"
                  style={{
                    backgroundColor: online ? "#fffbeb" : "#f8fafc",
                    borderWidth: 1,
                    borderColor: online ? "#fde68a" : "#e2e8f0",
                    shadowColor: online ? C.amber : "#000",
                    shadowOpacity: online ? 0.12 : 0.04,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 3,
                  }}>
                  <View className="p-md flex-row items-center gap-md">
                    <View className="w-12 h-12 rounded-2xl items-center justify-center"
                      style={{ backgroundColor: online ? C.amberDark : "#e2e8f0" }}>
                      <BarChart3 size={22} color="#fff" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-900 font-extrabold text-base">Business Analytics</Text>
                      <Text className="text-slate-500 text-xs mt-xs">
                        {online ? "Charts · Trends · Leaderboard · Margins" : "Requires connection"}
                      </Text>
                    </View>
                    <View className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: online ? C.amberDark + "18" : "#f1f5f9" }}>
                      <ChevronRight size={16} color={online ? C.amberDark : C.muted} />
                    </View>
                  </View>
                </Pressable>
              </View>
            )}

            {/* ── Sync Conflicts ── */}
            {isManagerOrAdmin && (
              <View className="px-lg mt-sm">
                <Pressable onPress={() => router.push("/conflicts")} accessibilityLabel="Sync conflicts"
                  className="flex-row items-center justify-between rounded-2xl bg-white border border-slate-100 p-md active:opacity-80"
                  style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                  <View className="flex-row items-center gap-sm">
                    <View className="w-10 h-10 rounded-xl bg-rose-100 items-center justify-center">
                      <GitPullRequestArrow size={18} color={C.rose} />
                    </View>
                    <View>
                      <Text className="text-slate-900 font-semibold">Sync Conflicts</Text>
                      <Text className="text-slate-500 text-xs">Review flagged offline sales</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={C.muted} />
                </Pressable>
              </View>
            )}

            {/* ── Audit Log ── */}
            {isSuperAdmin && (
              <View className="px-lg mt-sm">
                <Pressable onPress={() => { if (online) router.push("/audit"); }}
                  accessibilityLabel="View audit log"
                  className="flex-row items-center justify-between rounded-2xl p-md active:opacity-80"
                  style={{
                    backgroundColor: C.navy,
                    shadowColor: C.navy,
                    shadowOpacity: 0.2,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 4,
                  }}>
                  <View className="flex-row items-center gap-sm">
                    <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: "#ffffff15" }}>
                      <ShieldCheck size={18} color={C.amber} />
                    </View>
                    <View>
                      <Text className="text-white font-semibold">Audit Log</Text>
                      <Text style={{ color: "#64748b", fontSize: 12 }}>
                        {online ? "Append-only system activity" : "Requires connection"}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#475569" />
                </Pressable>
              </View>
            )}

            {/* ── Distributors ── */}
            <View className="px-lg mt-xl">
              <View className="flex-row items-center justify-between mb-md">
                <View className="flex-row items-center gap-sm">
                  <Users size={18} color={C.navy} />
                  <Text className="text-slate-900 text-base font-extrabold">Distributors</Text>
                </View>
                {distributors.length > 0 && (
                  <View className="rounded-full px-sm py-xs" style={{ backgroundColor: C.navy + "12" }}>
                    <Text style={{ color: C.navy, fontSize: 11, fontWeight: "700" }}>{distributors.length} active</Text>
                  </View>
                )}
              </View>
              {loading ? (
                <Skeleton />
              ) : !online && distributors.length === 0 ? (
                <View className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                  <EmptyState icon={<Users size={26} color="#94a3b8" />} title="Offline"
                    description="Distributor list requires a connection." />
                </View>
              ) : distributors.length === 0 ? (
                <View className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                  <EmptyState icon={<Users size={26} color="#94a3b8" />} title="No distributors"
                    description="Create distributor accounts from Profile." />
                </View>
              ) : (
                <View className="gap-sm">
                  {distributors.map((d) => (
                    <Pressable key={d.id}
                      onPress={() => router.push({ pathname: "/distributor/[id]", params: { id: String(d.id), name: d.name } })}
                      className="flex-row items-center justify-between rounded-2xl bg-white border border-slate-100 p-md active:opacity-80"
                      style={{ shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}>
                      <View className="flex-row items-center gap-sm flex-1">
                        <View className="w-11 h-11 rounded-2xl items-center justify-center"
                          style={{ backgroundColor: C.navy }}>
                          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{d.name[0]}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-slate-900 font-semibold">{d.name}</Text>
                          <Text className="text-slate-500 text-xs">@{d.username}{!d.active ? " · inactive" : ""}</Text>
                        </View>
                      </View>
                      <View className="w-8 h-8 rounded-full items-center justify-center bg-slate-100">
                        <ChevronRight size={16} color={C.muted} />
                      </View>
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

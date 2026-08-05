
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Plus, HandCoins, Boxes, Users, ChevronRight, TrendingUp, ShieldCheck, BarChart3, AlertTriangle, Undo2, ClipboardCheck } from "lucide-react-native";
import { useAuth, authFetch, roleLabel } from "@/lib/auth";
import { StatCard, Skeleton, EmptyState } from "@/components/ui";

export default function Home() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const [balance, setBalance] = useState<any>(null);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDistributor = user?.role === "distributor";
  const isSuperAdmin = user?.role === "super_admin";
  const isManagerOrAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";

  useEffect(() => { if (!hydrated) hydrate(); }, [hydrated]);
  useEffect(() => { if (hydrated && !user) router.replace("/login"); }, [hydrated, user]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      if (isDistributor) {
        const [b, h] = await Promise.all([authFetch("/api/sales/balance"), authFetch("/api/stock/holdings")]);
        setBalance(b); setHoldings(h);
      } else {
        const [d, ls] = await Promise.all([authFetch("/api/users/distributors"), authFetch("/api/stock/low-stock")]);
        setDistributors(d); setLowStock(ls);
      }
    } catch {}
    setLoading(false);
  }, [user, isDistributor]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!user) return null;
  const totalStock = holdings.reduce((a, h) => a + h.quantity, 0);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <ScrollView className="flex-1" contentContainerClassName="pb-3xl" showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}>
        <View className="px-lg pt-md pb-lg">
          <Text className="text-stone-500 text-sm">{roleLabel[user.role]}</Text>
          <Text className="text-stone-900 text-2xl font-extrabold">Hare Krishna, {user.name.split(" ")[0]}</Text>
        </View>

        {isDistributor ? (
          <>
            <View className="mx-lg rounded-2xl bg-amber-600 p-xl">
              <Text className="text-amber-100 text-xs tracking-wider">OUTSTANDING BALANCE</Text>
              <Text className="text-white text-4xl font-extrabold mt-xs">
                ₹{loading ? "—" : (balance?.outstanding ?? 0).toLocaleString("en-IN")}
              </Text>
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
                <Pressable onPress={() => router.push("/sale/new")} accessibilityLabel="Log a sale"
                  className="flex-1 flex-row items-center justify-center gap-xs rounded-xl bg-amber-600 py-md active:opacity-80">
                  <Plus size={16} color="#fff" />
                  <Text className="text-white font-semibold">Log Sale</Text>
                </Pressable>
                <Pressable onPress={() => router.push("/remittance/new")} accessibilityLabel="Log a remittance"
                  className="flex-1 flex-row items-center justify-center gap-xs rounded-xl bg-stone-200 py-md active:opacity-70">
                  <HandCoins size={16} color="#292524" />
                  <Text className="text-stone-900 font-semibold">Remit</Text>
                </Pressable>
              </View>
            </View>

            <View className="px-lg mt-xl">
              <Text className="text-stone-900 text-lg font-bold mb-sm">My Stock on Hand</Text>
              {loading ? <Skeleton /> : holdings.length === 0 ? (
                <View className="rounded-xl bg-white border border-stone-200">
                  <EmptyState icon={<Boxes size={26} color="#a8a29e" />} title="No stock assigned yet" description="Your manager will assign books to you soon." />
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
            {/* Low-stock alert banner (admin/manager only) */}
            {!loading && lowStock.length > 0 && (
              <View className="mx-lg mb-md rounded-xl bg-rose-50 border border-rose-200 p-md">
                <View className="flex-row items-center gap-xs mb-xs">
                  <AlertTriangle size={18} color="#e11d48" />
                  <Text className="text-rose-700 font-bold">{lowStock.length} title{lowStock.length === 1 ? "" : "s"} low on stock</Text>
                </View>
                <View className="gap-xs mt-xs">
                  {lowStock.slice(0, 4).map((b) => (
                    <Pressable key={b.id} onPress={() => router.push({ pathname: "/book/[id]", params: { id: String(b.id) } })}
                      className="flex-row items-center justify-between active:opacity-70">
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

            <View className="px-lg">
              <View className="flex-row gap-sm">
                <Pressable onPress={() => router.push("/stock/assign")} accessibilityLabel="Assign stock"
                  className="flex-1 flex-row items-center justify-center gap-xs rounded-xl bg-amber-600 py-md active:opacity-80">
                  <Boxes size={16} color="#fff" />
                  <Text className="text-white font-semibold">Assign Stock</Text>
                </Pressable>
                <Pressable onPress={() => router.push("/(tabs)/catalog")} accessibilityLabel="Manage catalog"
                  className="flex-1 flex-row items-center justify-center gap-xs rounded-xl bg-stone-200 py-md active:opacity-70">
                  <TrendingUp size={16} color="#292524" />
                  <Text className="text-stone-900 font-semibold">Catalog</Text>
                </Pressable>
              </View>
              <View className="flex-row gap-sm mt-sm">
                <Pressable onPress={() => router.push("/stock/return")} accessibilityLabel="Return stock"
                  className="flex-1 flex-row items-center justify-center gap-xs rounded-xl bg-stone-200 py-md active:opacity-70">
                  <Undo2 size={16} color="#292524" />
                  <Text className="text-stone-900 font-semibold">Return Stock</Text>
                </Pressable>
                <Pressable onPress={() => router.push("/stock/reconcile")} accessibilityLabel="Reconcile stock"
                  className="flex-1 flex-row items-center justify-center gap-xs rounded-xl bg-stone-200 py-md active:opacity-70">
                  <ClipboardCheck size={16} color="#292524" />
                  <Text className="text-stone-900 font-semibold">Reconcile</Text>
                </Pressable>
              </View>
            </View>

            {isManagerOrAdmin && (
              <View className="px-lg mt-md">
                <Pressable onPress={() => router.push("/reports")} accessibilityLabel="View reports"
                  className="flex-row items-center justify-between rounded-xl bg-amber-50 border border-amber-200 p-md active:opacity-80">
                  <View className="flex-row items-center gap-sm">
                    <View className="w-9 h-9 rounded-full bg-amber-600 items-center justify-center">
                      <BarChart3 size={18} color="#fff" />
                    </View>
                    <View>
                      <Text className="text-stone-900 font-semibold">Reports & Analytics</Text>
                      <Text className="text-stone-500 text-xs">Sales, leaderboard & top titles</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#d97706" />
                </Pressable>
              </View>
            )}

            {isSuperAdmin && (
              <View className="px-lg mt-md">
                <Pressable onPress={() => router.push("/audit")} accessibilityLabel="View audit log"
                  className="flex-row items-center justify-between rounded-xl bg-stone-900 p-md active:opacity-80">
                  <View className="flex-row items-center gap-sm">
                    <View className="w-9 h-9 rounded-full bg-stone-700 items-center justify-center">
                      <ShieldCheck size={18} color="#fbbf24" />
                    </View>
                    <View>
                      <Text className="text-white font-semibold">Audit Log</Text>
                      <Text className="text-stone-400 text-xs">Append-only system activity</Text>
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
              {loading ? <Skeleton /> : distributors.length === 0 ? (
                <View className="rounded-xl bg-white border border-stone-200">
                  <EmptyState icon={<Users size={26} color="#a8a29e" />} title="No distributors" description="Create distributor accounts from Profile." />
                </View>
              ) : (
                <View className="gap-sm">
                  {distributors.map((d) => (
                    <Pressable key={d.id} onPress={() => router.push({ pathname: "/distributor/[id]", params: { id: String(d.id), name: d.name } })}
                      className="flex-row items-center justify-between rounded-xl bg-white border border-stone-200 p-md active:opacity-80">
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

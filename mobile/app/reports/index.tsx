
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, TrendingUp, Trophy, PieChart, BookOpen } from "lucide-react-native";
import { useAuth, authFetch } from "@/lib/auth";
import { Skeleton, EmptyState, Chip, StatCard } from "@/components/ui";

const RANGE_LABELS: Record<string, string> = {
  all: "All time",
  today: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Reports() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  const [range, setRange] = useState("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAllowed = user?.role === "super_admin" || user?.role === "inventory_manager";

  useEffect(() => {
    if (hydrated && !isAllowed) router.replace("/(tabs)");
  }, [hydrated, isAllowed]);

  const load = useCallback(async () => {
    try {
      const d = await authFetch(`/api/reports?range=${range}`);
      setData(d);
    } catch {}
    setLoading(false);
  }, [range]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!isAllowed) return null;

  const s = data?.summary;
  const inr = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`;
  const maxCatValue = data?.categories?.length ? Math.max(...data.categories.map((c: any) => c.value)) : 0;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Reports</Text>
      </View>

      <View className="py-xs">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg gap-sm">
          {Object.keys(RANGE_LABELS).map((r) => (
            <Chip key={r} label={RANGE_LABELS[r]} active={range === r} onPress={() => setRange(r)} />
          ))}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl pt-sm" showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}>
        {loading ? <Skeleton count={6} /> : !data ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState icon={<TrendingUp size={26} color="#a8a29e" />} title="No report data" description="Sales activity will appear here once distributors start logging sales." />
          </View>
        ) : (
          <>
            {/* Hero summary */}
            <View className="rounded-2xl bg-amber-600 p-xl">
              <Text className="text-amber-100 text-xs tracking-wider">TOTAL SALES VALUE</Text>
              <Text className="text-white text-4xl font-extrabold mt-xs">{inr(s.totalSalesValue)}</Text>
              <View className="flex-row mt-lg pt-md border-t border-amber-400/40 gap-lg">
                <View>
                  <Text className="text-amber-100 text-xs">COPIES SOLD</Text>
                  <Text className="text-white font-bold">{s.totalCopies}</Text>
                </View>
                <View>
                  <Text className="text-amber-100 text-xs">OUTSTANDING</Text>
                  <Text className="text-white font-bold">{inr(s.outstanding)}</Text>
                </View>
              </View>
            </View>

            <View className="flex-row gap-sm mt-lg">
              <StatCard label="Cash" value={inr(s.cashTotal)} tone="success" />
              <StatCard label="Online" value={inr(s.onlineTotal)} />
              <StatCard label="Debt" value={inr(s.debtTotal)} tone="danger" />
            </View>

            {/* Leaderboard */}
            <View className="flex-row items-center gap-xs mt-xl mb-sm">
              <Trophy size={18} color="#292524" />
              <Text className="text-stone-900 text-lg font-bold">Distributor Leaderboard</Text>
            </View>
            {data.leaderboard.length === 0 ? (
              <View className="rounded-xl bg-white border border-stone-200">
                <EmptyState icon={<Trophy size={24} color="#a8a29e" />} title="No sales yet" description="Rankings appear once sales are logged." />
              </View>
            ) : (
              <View className="gap-sm">
                {data.leaderboard.map((l: any, i: number) => (
                  <Pressable key={l.distributorId} onPress={() => router.push({ pathname: "/distributor/[id]", params: { id: String(l.distributorId), name: l.name } })}
                    className="flex-row items-center rounded-xl bg-white border border-stone-200 p-md active:opacity-80">
                    <View className="w-8 items-center mr-sm">
                      <Text className="text-lg">{MEDALS[i] || `#${i + 1}`}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-stone-900 font-semibold">{l.name}</Text>
                      <Text className="text-stone-500 text-xs">{l.copies} copies sold</Text>
                    </View>
                    <Text className="text-amber-700 font-extrabold">{inr(l.value)}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Category breakdown */}
            <View className="flex-row items-center gap-xs mt-xl mb-sm">
              <PieChart size={18} color="#292524" />
              <Text className="text-stone-900 text-lg font-bold">Sales by Category</Text>
            </View>
            {data.categories.length === 0 ? (
              <View className="rounded-xl bg-white border border-stone-200">
                <EmptyState icon={<PieChart size={24} color="#a8a29e" />} title="No category data" description="Category totals appear after sales are logged." />
              </View>
            ) : (
              <View className="gap-sm">
                {data.categories.map((c: any) => (
                  <View key={c.category} className="rounded-xl bg-white border border-stone-200 p-md">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{c.category}</Text>
                      <Text className="text-stone-900 font-bold">{inr(c.value)}</Text>
                    </View>
                    <View className="h-2 rounded-full bg-stone-100 mt-sm overflow-hidden">
                      <View className="h-2 rounded-full bg-amber-500" style={{ width: `${maxCatValue > 0 ? Math.max(6, (c.value / maxCatValue) * 100) : 0}%` }} />
                    </View>
                    <Text className="text-stone-500 text-xs mt-xs">{c.copies} copies</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Top books */}
            <View className="flex-row items-center gap-xs mt-xl mb-sm">
              <BookOpen size={18} color="#292524" />
              <Text className="text-stone-900 text-lg font-bold">Top-Selling Titles</Text>
            </View>
            {data.topBooks.length === 0 ? (
              <View className="rounded-xl bg-white border border-stone-200">
                <EmptyState icon={<BookOpen size={24} color="#a8a29e" />} title="No titles sold" description="Best sellers appear once sales are logged." />
              </View>
            ) : (
              <View className="gap-sm">
                {data.topBooks.map((b: any, i: number) => (
                  <View key={b.sku} className="flex-row items-center rounded-xl bg-white border border-stone-200 p-md">
                    <View className="w-8 h-8 rounded-full bg-amber-100 items-center justify-center mr-sm">
                      <Text className="text-amber-700 font-bold text-xs">{i + 1}</Text>
                    </View>
                    <View className="flex-1 pr-sm">
                      <Text className="text-stone-900 font-semibold" numberOfLines={1}>{b.title}</Text>
                      <Text className="text-stone-500 text-xs">{b.sku}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-amber-700 font-extrabold">{b.copies}</Text>
                      <Text className="text-stone-400 text-xs">copies</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

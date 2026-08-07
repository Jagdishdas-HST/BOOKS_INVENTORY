
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, TrendingUp, Trophy, PieChart, BookOpen, LineChart, Percent } from "lucide-react-native";
import { format } from "date-fns";
import { useAuth, authFetch } from "@/lib/auth";
import { Skeleton, EmptyState, Chip, StatCard } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";

const RANGE_LABELS: Record<string, string> = {
  all: "All time",
  today: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
};

const BUCKET_LABELS: Record<string, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Reports() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  const [range, setRange] = useState("all");
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [distributorFilter, setDistributorFilter] = useState<number | "all">("all");
  const [trendMode, setTrendMode] = useState<"value" | "copies">("value");

  const [categories, setCategories] = useState<string[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);

  const [data, setData] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [margin, setMargin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAllowed = user?.role === "super_admin" || user?.role === "inventory_manager";

  useEffect(() => {
    if (hydrated && !isAllowed) router.replace("/(tabs)");
  }, [hydrated, isAllowed]);

  useEffect(() => {
    authFetch("/api/reports/categories").then(setCategories).catch(() => {});
    authFetch("/api/users/distributors").then(setDistributors).catch(() => {});
  }, []);

  const filterQs = useCallback(() => {
    const p = new URLSearchParams();
    p.set("range", range);
    if (categoryFilter !== "all") p.set("category", categoryFilter);
    if (distributorFilter !== "all") p.set("distributorId", String(distributorFilter));
    return p;
  }, [range, categoryFilter, distributorFilter]);

  const load = useCallback(async () => {
    try {
      const base = filterQs().toString();
      const trendQs = new URLSearchParams(filterQs());
      trendQs.set("bucket", bucket);
      const [d, t, m] = await Promise.all([
        authFetch(`/api/reports?${base}`),
        authFetch(`/api/reports/trends?${trendQs.toString()}`),
        authFetch(`/api/reports/margin?${base}`),
      ]);
      setData(d); setTrends(t); setMargin(m);
    } catch {}
    setLoading(false);
  }, [filterQs, bucket]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!isAllowed) return null;

  const s = data?.summary;
  const inr = (n: number) => `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;
  const maxCatValue = data?.categories?.length ? Math.max(...data.categories.map((c: any) => c.value)) : 0;

  const trendPoints = trends?.points ?? [];
  const maxTrend = trendPoints.length
    ? Math.max(...trendPoints.map((p: any) => (trendMode === "value" ? p.value : p.copies)))
    : 0;

  const fmtPeriod = (iso: string) => {
    try {
      const d = new Date(iso);
      if (bucket === "month") return format(d, "MMM");
      return format(d, "d MMM");
    } catch { return iso; }
  };

  // Export path carries the current filters.
  const exportBase = `?${filterQs().toString()}`;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center justify-between px-lg pt-md pb-sm">
        <View className="flex-row items-center gap-sm">
          <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
          <Text className="text-stone-900 text-xl font-extrabold">Reports</Text>
        </View>
        <ExportButton path={`/api/reports/export/sales.csv${exportBase}`} label="Sales CSV" />
      </View>

      {/* Range filter */}
      <View className="pt-xs">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg gap-sm">
          {Object.keys(RANGE_LABELS).map((r) => (
            <Chip key={r} label={RANGE_LABELS[r]} active={range === r} onPress={() => setRange(r)} />
          ))}
        </ScrollView>
      </View>

      {/* Category filter */}
      <View className="pt-sm">
        <Text className="px-lg text-stone-500 text-xs uppercase tracking-wide mb-xs">Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg gap-sm">
          <Chip label="All" active={categoryFilter === "all"} onPress={() => setCategoryFilter("all")} />
          {categories.map((c) => (
            <Chip key={c} label={c} active={categoryFilter === c} onPress={() => setCategoryFilter(c)} />
          ))}
        </ScrollView>
      </View>

      {/* Distributor filter */}
      <View className="pt-sm">
        <Text className="px-lg text-stone-500 text-xs uppercase tracking-wide mb-xs">Distributor</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg gap-sm">
          <Chip label="All" active={distributorFilter === "all"} onPress={() => setDistributorFilter("all")} />
          {distributors.map((d) => (
            <Chip key={d.id} label={d.name} active={distributorFilter === d.id} onPress={() => setDistributorFilter(d.id)} />
          ))}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl pt-md" showsVerticalScrollIndicator={false}
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
                  <Text className="text-amber-100 text-xs">FREE COPIES</Text>
                  <Text className="text-white font-bold">{s.freeCopies ?? 0}</Text>
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

            {/* TREND CHARTS */}
            <View className="flex-row items-center justify-between mt-xl mb-sm">
              <View className="flex-row items-center gap-xs">
                <LineChart size={18} color="#292524" />
                <Text className="text-stone-900 text-lg font-bold">Sales Trend</Text>
              </View>
              <View className="flex-row gap-xs">
                <Pressable onPress={() => setTrendMode("value")} accessibilityLabel="Show value"
                  className={`rounded-full px-sm py-[3px] ${trendMode === "value" ? "bg-amber-600" : "bg-stone-200"}`}>
                  <Text className={`text-xs font-semibold ${trendMode === "value" ? "text-white" : "text-stone-600"}`}>Value</Text>
                </Pressable>
                <Pressable onPress={() => setTrendMode("copies")} accessibilityLabel="Show volume"
                  className={`rounded-full px-sm py-[3px] ${trendMode === "copies" ? "bg-amber-600" : "bg-stone-200"}`}>
                  <Text className={`text-xs font-semibold ${trendMode === "copies" ? "text-white" : "text-stone-600"}`}>Volume</Text>
                </Pressable>
              </View>
            </View>

            <View className="mb-sm">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm">
                {Object.keys(BUCKET_LABELS).map((b) => (
                  <Chip key={b} label={BUCKET_LABELS[b]} active={bucket === b} onPress={() => setBucket(b as any)} />
                ))}
              </ScrollView>
            </View>

            <View className="rounded-xl bg-white border border-stone-200 p-md">
              {trendPoints.length === 0 ? (
                <EmptyState icon={<LineChart size={24} color="#a8a29e" />} title="No trend data" description="Trend appears once sales are logged in this range." />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-md pt-sm">
                  {trendPoints.map((p: any) => {
                    const v = trendMode === "value" ? p.value : p.copies;
                    const h = maxTrend > 0 ? Math.max(6, (v / maxTrend) * 140) : 6;
                    return (
                      <View key={p.period} className="items-center" style={{ width: 46 }}>
                        <Text className="text-stone-500 text-[10px] mb-xs" numberOfLines={1}>
                          {trendMode === "value" ? `₹${Math.round(v).toLocaleString("en-IN")}` : v}
                        </Text>
                        <View className="justify-end" style={{ height: 150 }}>
                          <View className="w-6 rounded-t-md bg-amber-500" style={{ height: h }} />
                        </View>
                        <Text className="text-stone-500 text-[10px] mt-xs" numberOfLines={1}>{fmtPeriod(p.period)}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* PROFIT MARGIN */}
            <View className="flex-row items-center justify-between mt-xl mb-sm">
              <View className="flex-row items-center gap-xs">
                <Percent size={18} color="#292524" />
                <Text className="text-stone-900 text-lg font-bold">Profit Margin</Text>
              </View>
              <ExportButton path={`/api/reports/export/margin.csv${exportBase}`} label="CSV" />
            </View>

            {margin && (
              <>
                <View className="rounded-2xl bg-emerald-700 p-lg">
                  <Text className="text-emerald-100 text-xs tracking-wider">NET MARGIN (actual prices)</Text>
                  <Text className="text-white text-3xl font-extrabold mt-xs">{inr(margin.overall.margin)}</Text>
                  <View className="flex-row mt-md pt-sm border-t border-emerald-500/40 gap-lg">
                    <View>
                      <Text className="text-emerald-100 text-xs">REVENUE</Text>
                      <Text className="text-white font-bold">{inr(margin.overall.revenue)}</Text>
                    </View>
                    <View>
                      <Text className="text-emerald-100 text-xs">COST</Text>
                      <Text className="text-white font-bold">{inr(margin.overall.cost)}</Text>
                    </View>
                    <View>
                      <Text className="text-emerald-100 text-xs">MARGIN %</Text>
                      <Text className="text-white font-bold">{margin.overall.marginPct.toFixed(1)}%</Text>
                    </View>
                  </View>
                </View>

                {/* By category */}
                <Text className="text-stone-700 font-bold mt-lg mb-sm">Margin by Category</Text>
                {margin.byCategory.length === 0 ? (
                  <View className="rounded-xl bg-white border border-stone-200">
                    <EmptyState icon={<Percent size={24} color="#a8a29e" />} title="No margin data" description="Appears after sales are logged." />
                  </View>
                ) : (
                  <View className="gap-sm">
                    {margin.byCategory.map((c: any) => (
                      <View key={c.category} className="rounded-xl bg-white border border-stone-200 p-md">
                        <View className="flex-row justify-between items-center">
                          <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{c.category}</Text>
                          <Text className={`font-extrabold ${c.margin >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{inr(c.margin)}</Text>
                        </View>
                        <Text className="text-stone-500 text-xs mt-xs">Revenue {inr(c.revenue)} · Cost {inr(c.cost)} · {c.marginPct.toFixed(1)}%</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* By distributor */}
                <Text className="text-stone-700 font-bold mt-lg mb-sm">Margin by Distributor</Text>
                {margin.byDistributor.length === 0 ? (
                  <View className="rounded-xl bg-white border border-stone-200">
                    <EmptyState icon={<Percent size={24} color="#a8a29e" />} title="No margin data" description="Appears after sales are logged." />
                  </View>
                ) : (
                  <View className="gap-sm">
                    {margin.byDistributor.map((d: any) => (
                      <View key={d.distributorId} className="flex-row items-center justify-between rounded-xl bg-white border border-stone-200 p-md">
                        <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{d.name}</Text>
                        <View className="items-end">
                          <Text className={`font-extrabold ${d.margin >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{inr(d.margin)}</Text>
                          <Text className="text-stone-400 text-xs">{d.marginPct.toFixed(1)}%</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* By book */}
                <Text className="text-stone-700 font-bold mt-lg mb-sm">Margin by Title</Text>
                {margin.byBook.length === 0 ? (
                  <View className="rounded-xl bg-white border border-stone-200">
                    <EmptyState icon={<BookOpen size={24} color="#a8a29e" />} title="No titles sold" description="Appears after sales are logged." />
                  </View>
                ) : (
                  <View className="gap-sm">
                    {margin.byBook.map((b: any) => (
                      <View key={b.sku} className="rounded-xl bg-white border border-stone-200 p-md">
                        <View className="flex-row justify-between items-center">
                          <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{b.title}</Text>
                          <Text className={`font-extrabold ${b.margin >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{inr(b.margin)}</Text>
                        </View>
                        <Text className="text-stone-500 text-xs mt-xs">{b.sku} · {b.copies} copies · {b.marginPct.toFixed(1)}%</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Remittances export */}
            <View className="flex-row items-center justify-between mt-xl mb-sm">
              <Text className="text-stone-900 text-lg font-bold">Remittances</Text>
              <ExportButton path={`/api/reports/export/remittances.csv${distributorFilter !== "all" ? `?distributorId=${distributorFilter}` : ""}`} label="CSV" />
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

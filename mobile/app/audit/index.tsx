
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, ShieldCheck, Filter } from "lucide-react-native";
import { format } from "date-fns";
import { useAuth, authFetch, roleLabel, type Role } from "@/lib/auth";
import { Skeleton, EmptyState, Chip } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";

type AuditRow = {
  id: number;
  action: string;
  entity: string;
  details: string | null;
  createdAt: string;
  userName: string;
  userRole: Role;
};

const RANGE_LABELS: Record<string, string> = {
  all: "All time",
  today: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
};

function rangeToFrom(range: string): string | undefined {
  if (range === "all") return undefined;
  const now = new Date();
  if (range === "today") { now.setHours(0, 0, 0, 0); return now.toISOString(); }
  if (range === "week") { now.setDate(now.getDate() - 7); return now.toISOString(); }
  if (range === "month") { now.setDate(now.getDate() - 30); return now.toISOString(); }
  return undefined;
}

function actionColor(action: string): string {
  if (/deactivate|retire|delete/i.test(action)) return "bg-rose-100 text-rose-700";
  if (/create|assign|sale/i.test(action)) return "bg-emerald-100 text-emerald-700";
  if (/remit/i.test(action)) return "bg-sky-100 text-sky-700";
  if (/activate/i.test(action)) return "bg-amber-100 text-amber-700";
  return "bg-stone-100 text-stone-700";
}

export default function AuditLog() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [facets, setFacets] = useState<{ actions: string[]; entities: string[] }>({ actions: [], entities: [] });
  const [actionFilter, setActionFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (hydrated && (!user || user.role !== "super_admin")) router.replace("/(tabs)");
  }, [hydrated, user]);

  useEffect(() => {
    authFetch("/api/audit/facets").then(setFacets).catch(() => {});
  }, []);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (actionFilter !== "all") params.set("action", actionFilter);
    const from = rangeToFrom(rangeFilter);
    if (from) params.set("from", from);
    return params;
  }, [actionFilter, rangeFilter]);

  const load = useCallback(async () => {
    try {
      const qs = buildParams().toString();
      const data = await authFetch(`/api/audit${qs ? `?${qs}` : ""}`);
      setRows(data);
    } catch {}
    setLoading(false);
  }, [buildParams]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!user || user.role !== "super_admin") return null;

  const exportQs = buildParams().toString();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center justify-between px-lg pt-md pb-sm">
        <View className="flex-row items-center gap-sm">
          <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
          <Text className="text-stone-900 text-xl font-extrabold">Audit Log</Text>
        </View>
        <ExportButton path={`/api/reports/export/audit.csv${exportQs ? `?${exportQs}` : ""}`} label="Export CSV" />
      </View>

      <View className="px-lg pb-xs">
        <View className="flex-row items-center gap-xs mb-xs">
          <Filter size={14} color="#a8a29e" />
          <Text className="text-stone-500 text-xs uppercase tracking-wide">Action</Text>
        </View>
      </View>
      <View className="py-xs">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg gap-sm">
          <Chip label="All actions" active={actionFilter === "all"} onPress={() => setActionFilter("all")} />
          {facets.actions.map((a) => (
            <Chip key={a} label={a} active={actionFilter === a} onPress={() => setActionFilter(a)} />
          ))}
        </ScrollView>
      </View>

      <View className="px-lg pt-sm pb-xs">
        <Text className="text-stone-500 text-xs uppercase tracking-wide">Date range</Text>
      </View>
      <View className="py-xs">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg gap-sm">
          {Object.keys(RANGE_LABELS).map((r) => (
            <Chip key={r} label={RANGE_LABELS[r]} active={rangeFilter === r} onPress={() => setRangeFilter(r)} />
          ))}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl pt-sm" showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}>
        {loading ? <Skeleton count={6} /> : rows.length === 0 ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState icon={<ShieldCheck size={26} color="#a8a29e" />} title="No audit entries" description="Nothing matches the selected filters yet." />
          </View>
        ) : (
          <View className="gap-sm">
            {rows.map((r) => {
              const color = actionColor(r.action);
              return (
                <View key={r.id} className="rounded-xl bg-white border border-stone-200 p-md">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-sm">
                      <View className={`rounded-full px-sm py-[2px] ${color.split(" ")[0]}`}>
                        <Text className={`text-xs font-semibold ${color.split(" ")[1]}`}>{r.action.toUpperCase()}</Text>
                      </View>
                      <Text className="text-stone-500 text-xs">{r.entity}</Text>
                    </View>
                    <Text className="text-stone-400 text-xs">{format(new Date(r.createdAt), "d MMM, h:mm a")}</Text>
                  </View>
                  {r.details ? <Text className="text-stone-900 text-sm mt-xs">{r.details}</Text> : null}
                  <Text className="text-stone-500 text-xs mt-xs">{r.userName} · {roleLabel[r.userRole]}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

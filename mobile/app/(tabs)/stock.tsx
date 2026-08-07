
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Plus, ArrowRightLeft, ArrowDownLeft, PackagePlus, SlidersHorizontal } from "lucide-react-native";
import { format } from "date-fns";
import { authFetch, useAuth } from "@/lib/auth";
import { Skeleton, EmptyState } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";

function movementMeta(type: string) {
  switch (type) {
    case "stock_in": return { icon: PackagePlus, color: "#059669", bg: "bg-emerald-100", sign: "+", label: "Stock in" };
    case "return": return { icon: ArrowDownLeft, color: "#2563eb", bg: "bg-blue-100", sign: "+", label: "Return" };
    case "adjust": return { icon: SlidersHorizontal, color: "#7c3aed", bg: "bg-violet-100", sign: "", label: "Adjust" };
    default: return { icon: ArrowRightLeft, color: "#b45309", bg: "bg-amber-100", sign: "-", label: "Assign" };
  }
}

export default function Stock() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setMovements(await authFetch("/api/stock/movements")); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center justify-between px-lg pt-md pb-sm">
        <Text className="text-stone-900 text-2xl font-extrabold">Stock Movement</Text>
        <View className="flex-row gap-sm">
          <Pressable onPress={() => router.push("/stock/intake")} accessibilityLabel="Stock intake"
            className="w-10 h-10 rounded-full bg-emerald-600 items-center justify-center active:opacity-80">
            <PackagePlus size={20} color="#fff" />
          </Pressable>
          <Pressable onPress={() => router.push("/stock/assign")} accessibilityLabel="Assign stock"
            className="w-10 h-10 rounded-full bg-amber-600 items-center justify-center active:opacity-80">
            <Plus size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      {isAdmin && (
        <View className="px-lg pb-sm flex-row justify-end">
          <ExportButton path="/api/reports/export/stock.csv" label="Export CSV" />
        </View>
      )}

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl pt-sm" showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}>
        {loading ? <Skeleton count={5} /> : movements.length === 0 ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState icon={<ArrowRightLeft size={26} color="#a8a29e" />} title="No stock moved yet" description="Assign books to distributors or record a new intake." />
          </View>
        ) : (
          <View className="gap-sm">
            {movements.map((m) => {
              const meta = movementMeta(m.type);
              const Icon = meta.icon;
              return (
                <View key={m.id} className="flex-row items-center rounded-xl bg-white border border-stone-200 p-md">
                  <View className={`w-10 h-10 rounded-full items-center justify-center mr-sm ${meta.bg}`}>
                    <Icon size={16} color={meta.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-stone-900 font-semibold" numberOfLines={1}>{m.bookTitle}</Text>
                    <Text className="text-stone-500 text-xs">
                      {meta.label}
                      {m.distributorName ? ` · ${m.distributorName}` : m.reason ? ` · ${m.reason}` : ""}
                      {` · ${format(new Date(m.createdAt), "d MMM, h:mm a")}`}
                    </Text>
                  </View>
                  <Text className="font-extrabold text-lg" style={{ color: meta.color }}>{meta.sign}{Math.abs(m.quantity)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

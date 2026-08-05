
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Plus, ArrowRightLeft, Undo2, ClipboardCheck, Boxes } from "lucide-react-native";
import { format } from "date-fns";
import { authFetch } from "@/lib/auth";
import { Skeleton, EmptyState } from "@/components/ui";

export default function Stock() {
  const router = useRouter();
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
        <Pressable onPress={() => router.push("/stock/assign")} accessibilityLabel="Assign stock"
          className="w-10 h-10 rounded-full bg-amber-600 items-center justify-center active:opacity-80">
          <Plus size={20} color="#fff" />
        </Pressable>
      </View>

      <View className="px-lg pb-sm">
        <View className="flex-row gap-sm">
          <Pressable onPress={() => router.push("/stock/assign")} accessibilityLabel="Assign stock"
            className="flex-1 items-center rounded-xl bg-amber-600 py-sm active:opacity-80">
            <Boxes size={18} color="#fff" />
            <Text className="text-white text-xs font-semibold mt-xs">Assign</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/stock/return")} accessibilityLabel="Return stock"
            className="flex-1 items-center rounded-xl bg-stone-200 py-sm active:opacity-70">
            <Undo2 size={18} color="#292524" />
            <Text className="text-stone-900 text-xs font-semibold mt-xs">Return</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/stock/reconcile")} accessibilityLabel="Reconcile stock"
            className="flex-1 items-center rounded-xl bg-stone-200 py-sm active:opacity-70">
            <ClipboardCheck size={18} color="#292524" />
            <Text className="text-stone-900 text-xs font-semibold mt-xs">Reconcile</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl pt-sm" showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}>
        {loading ? <Skeleton count={5} /> : movements.length === 0 ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState icon={<ArrowRightLeft size={26} color="#a8a29e" />} title="No stock moved yet" description="Assign books from the warehouse to distributors." />
          </View>
        ) : (
          <View className="gap-sm">
            {movements.map((m) => {
              const isReturn = m.type === "return";
              return (
                <View key={m.id} className="flex-row items-center rounded-xl bg-white border border-stone-200 p-md">
                  <View className={`w-10 h-10 rounded-full items-center justify-center mr-sm ${isReturn ? "bg-sky-100" : "bg-amber-100"}`}>
                    {isReturn ? <Undo2 size={16} color="#0369a1" /> : <ArrowRightLeft size={16} color="#b45309" />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-stone-900 font-semibold" numberOfLines={1}>{m.bookTitle}</Text>
                    <Text className="text-stone-500 text-xs">
                      {isReturn ? "←" : "→"} {m.distributorName}
                      {isReturn && m.reason ? ` · ${m.reason}` : ""} · {format(new Date(m.createdAt), "d MMM, h:mm a")}
                    </Text>
                  </View>
                  <Text className={`font-extrabold text-lg ${isReturn ? "text-sky-700" : "text-amber-700"}`}>
                    {isReturn ? "−" : "+"}{m.quantity}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

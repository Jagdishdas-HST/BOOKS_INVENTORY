
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, Bell, AlertTriangle, HandCoins } from "lucide-react-native";
import { authFetch, useAuth } from "@/lib/auth";
import { Skeleton, EmptyState } from "@/components/ui";

export default function Notifications() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const res = await authFetch("/api/notifications"); setItems(res.notifications || []); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const meta = (sev: string) => sev === "danger"
    ? { bg: "bg-rose-50", border: "border-rose-200", color: "#e11d48", text: "text-rose-700" }
    : sev === "warning"
    ? { bg: "bg-amber-50", border: "border-amber-200", color: "#d97706", text: "text-amber-700" }
    : { bg: "bg-sky-50", border: "border-sky-200", color: "#0284c7", text: "text-sky-700" };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Notifications</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl pt-sm" showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}>
        {loading ? <Skeleton count={4} /> : items.length === 0 ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState icon={<Bell size={26} color="#a8a29e" />} title="All clear" description={isAdmin ? "No low-stock alerts right now." : "No pending remittance alerts right now."} />
          </View>
        ) : (
          <View className="gap-sm">
            {items.map((n) => {
              const m = meta(n.severity);
              const Icon = n.type === "low_stock" ? AlertTriangle : HandCoins;
              const clickable = n.type === "low_stock" && n.entityId;
              const inner = (
                <View className={`rounded-xl ${m.bg} border ${m.border} p-md`}>
                  <View className="flex-row items-center gap-xs mb-xs">
                    <Icon size={18} color={m.color} />
                    <Text className={`${m.text} font-bold`}>{n.title}</Text>
                  </View>
                  <Text className="text-stone-700 text-sm">{n.body}</Text>
                </View>
              );
              return clickable ? (
                <Pressable key={n.id} onPress={() => router.push({ pathname: "/book/[id]", params: { id: String(n.entityId) } })} className="active:opacity-80">
                  {inner}
                </Pressable>
              ) : <View key={n.id}>{inner}</View>;
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

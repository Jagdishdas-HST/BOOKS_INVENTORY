
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Receipt, HandCoins } from "lucide-react-native";
import { format } from "date-fns";
import { authFetch } from "@/lib/auth";
import { Skeleton, EmptyState, Chip } from "@/components/ui";

export default function Ledger() {
  const [tab, setTab] = useState<"sales" | "remittances">("sales");
  const [sales, setSales] = useState<any[]>([]);
  const [remits, setRemits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([authFetch("/api/sales"), authFetch("/api/remittances")]);
      setSales(s); setRemits(r);
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const badge = (t: string) => t === "cash" ? "bg-emerald-100 text-emerald-700" : t === "online" ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <Text className="text-stone-900 text-2xl font-extrabold px-lg pt-md pb-sm">My Ledger</Text>
      <View className="py-xs">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg gap-sm">
          <Chip label="Sales" active={tab === "sales"} onPress={() => setTab("sales")} />
          <Chip label="Remittances" active={tab === "remittances"} onPress={() => setTab("remittances")} />
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl pt-sm" showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}>
        {loading ? <Skeleton count={5} /> : tab === "sales" ? (
          sales.length === 0 ? (
            <View className="rounded-xl bg-white border border-stone-200 mt-lg">
              <EmptyState icon={<Receipt size={26} color="#a8a29e" />} title="No sales logged" description="Log your first sale from the Home tab." />
            </View>
          ) : (
            <View className="gap-sm">
              {sales.map((s) => (
                <View key={s.id} className="rounded-xl bg-white border border-stone-200 p-md">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{s.bookTitle}</Text>
                    <Text className="text-stone-900 font-extrabold">₹{s.totalValue}</Text>
                  </View>
                  <View className="flex-row items-center justify-between mt-xs">
                    <View className="flex-row items-center gap-sm">
                      <View className={`rounded-full px-sm py-[2px] ${badge(s.paymentType)}`}>
                        <Text className={`text-xs font-semibold ${badge(s.paymentType).split(" ")[1]}`}>{s.paymentType.toUpperCase()}</Text>
                      </View>
                      <Text className="text-stone-500 text-xs">{s.quantity} × ₹{s.unitPrice}</Text>
                    </View>
                    <Text className="text-stone-400 text-xs">{format(new Date(s.createdAt), "d MMM, h:mm a")}</Text>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : (
          remits.length === 0 ? (
            <View className="rounded-xl bg-white border border-stone-200 mt-lg">
              <EmptyState icon={<HandCoins size={26} color="#a8a29e" />} title="No remittances" description="Log a payment to reduce your outstanding balance." />
            </View>
          ) : (
            <View className="gap-sm">
              {remits.map((r) => (
                <View key={r.id} className="flex-row items-center justify-between rounded-xl bg-white border border-stone-200 p-md">
                  <View className="flex-1">
                    <Text className="text-stone-900 font-semibold">₹{r.amount}</Text>
                    <Text className="text-stone-500 text-xs">{r.note || "No note"} · {format(new Date(r.createdAt), "d MMM, h:mm a")}</Text>
                  </View>
                  <View className="rounded-full bg-emerald-100 px-sm py-[2px]">
                    <Text className="text-emerald-700 text-xs font-semibold">PAID</Text>
                  </View>
                </View>
              ))}
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

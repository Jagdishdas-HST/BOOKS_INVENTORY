
import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, TrendingUp, TrendingDown, History } from "lucide-react-native";
import { format } from "date-fns";
import { authFetch } from "@/lib/auth";
import { Skeleton, EmptyState } from "@/components/ui";

export default function PriceHistory() {
  const router = useRouter();
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`/api/books/${id}/price-history`).then((r) => { setRows(r); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <View className="flex-1">
          <Text className="text-stone-900 text-xl font-extrabold">Price History</Text>
          {title ? <Text className="text-stone-500 text-xs" numberOfLines={1}>{title}</Text> : null}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl pt-sm" showsVerticalScrollIndicator={false}>
        {loading ? <Skeleton count={4} /> : rows.length === 0 ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState icon={<History size={26} color="#a8a29e" />} title="No price changes" description="Cost and retail prices haven't been edited yet." />
          </View>
        ) : (
          <View className="gap-sm">
            {rows.map((r) => {
              const up = Number(r.newValue) > Number(r.oldValue);
              const label = r.field === "cost_price" ? "Cost price" : "Retail price";
              return (
                <View key={r.id} className="rounded-xl bg-white border border-stone-200 p-md">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-stone-900 font-semibold">{label}</Text>
                    <View className={`flex-row items-center gap-xs px-sm py-xs rounded-full ${up ? "bg-rose-50" : "bg-emerald-50"}`}>
                      {up ? <TrendingUp size={14} color="#e11d48" /> : <TrendingDown size={14} color="#059669" />}
                      <Text className={`text-xs font-semibold ${up ? "text-rose-600" : "text-emerald-600"}`}>
                        ₹{r.oldValue} → ₹{r.newValue}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-stone-500 text-xs mt-sm">
                    by {r.changedByName} · {format(new Date(r.createdAt), "d MMM yyyy, h:mm a")}
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

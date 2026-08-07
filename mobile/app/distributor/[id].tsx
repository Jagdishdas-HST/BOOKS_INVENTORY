
import { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, FileText, HandCoins } from "lucide-react-native";
import { Pressable } from "react-native";
import { format } from "date-fns";
import { authFetch } from "@/lib/auth";
import { StatCard, Skeleton, EmptyState } from "@/components/ui";
import { Boxes } from "lucide-react-native";

export default function DistributorDetail() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const [balance, setBalance] = useState<any>(null);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [remits, setRemits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authFetch(`/api/sales/balance?distributorId=${id}`),
      authFetch(`/api/stock/holdings?distributorId=${id}`),
      authFetch(`/api/sales?distributorId=${id}`),
      authFetch(`/api/remittances?distributorId=${id}`),
    ]).then(([b, h, s, r]) => { setBalance(b); setHoldings(h); setSales(s); setRemits(r); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  const badge = (t: string) => t === "cash" ? "text-emerald-700" : t === "online" ? "text-sky-700" : t === "free" ? "text-purple-700" : "text-rose-700";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">{name}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        {loading ? <Skeleton count={4} /> : (
          <>
            <View className="rounded-2xl bg-amber-600 p-lg mb-md">
              <Text className="text-amber-100 text-xs tracking-wider">OUTSTANDING BALANCE</Text>
              <Text className="text-white text-3xl font-extrabold mt-xs">₹{(balance?.outstanding ?? 0).toLocaleString("en-IN")}</Text>
            </View>

            <View className="flex-row gap-sm mb-md">
              <Pressable onPress={() => router.push({ pathname: "/statement", params: { distributorId: String(id), name: String(name) } })}
                accessibilityLabel="Generate statement"
                className="flex-1 flex-row items-center justify-center gap-sm rounded-xl bg-stone-900 py-md active:opacity-80">
                <FileText size={18} color="#fff" />
                <Text className="text-white font-semibold">Statement</Text>
              </Pressable>
              <Pressable onPress={() => router.push({ pathname: "/remittance/new", params: { distributorId: String(id), name: String(name) } })}
                accessibilityLabel="Log remittance for distributor"
                className="flex-1 flex-row items-center justify-center gap-sm rounded-xl bg-emerald-600 py-md active:opacity-80">
                <HandCoins size={18} color="#fff" />
                <Text className="text-white font-semibold">Log Payment</Text>
              </Pressable>
            </View>

            <View className="flex-row gap-sm mb-lg">
              <StatCard label="Debt sales" value={`₹${(balance?.debtTotal ?? 0).toLocaleString("en-IN")}`} tone="danger" />
              <StatCard label="Remitted" value={`₹${(balance?.remittedTotal ?? 0).toLocaleString("en-IN")}`} tone="success" />
            </View>
            <View className="flex-row gap-sm mb-lg">
              <StatCard label="Cash" value={`₹${(balance?.cashTotal ?? 0).toLocaleString("en-IN")}`} />
              <StatCard label="Online" value={`₹${(balance?.onlineTotal ?? 0).toLocaleString("en-IN")}`} />
            </View>
            <View className="flex-row gap-sm mb-lg">
              <StatCard label="Free copies" value={`${balance?.freeCopies ?? 0}`} />
              <StatCard label="Discounted" value={`₹${(balance?.discountedTotal ?? 0).toLocaleString("en-IN")}`} />
            </View>

            <Text className="text-stone-900 text-lg font-bold mb-sm">Stock on Hand</Text>
            {holdings.length === 0 ? (
              <View className="rounded-xl bg-white border border-stone-200 mb-lg">
                <EmptyState icon={<Boxes size={24} color="#a8a29e" />} title="No stock" description="No books assigned yet." />
              </View>
            ) : (
              <View className="gap-sm mb-lg">
                {holdings.map((h) => (
                  <View key={h.id} className="flex-row justify-between rounded-xl bg-white border border-stone-200 p-md">
                    <Text className="text-stone-900 font-semibold flex-1" numberOfLines={1}>{h.title}</Text>
                    <Text className="text-amber-700 font-bold">{h.quantity}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text className="text-stone-900 text-lg font-bold mb-sm">Recent Sales</Text>
            <View className="gap-sm mb-lg">
              {sales.slice(0, 10).map((s) => (
                <View key={s.id} className="flex-row justify-between items-center rounded-xl bg-white border border-stone-200 p-md">
                  <View className="flex-1 pr-sm">
                    <Text className="text-stone-900 font-semibold" numberOfLines={1}>{s.bookTitle}</Text>
                    <Text className={`text-xs font-semibold ${badge(s.paymentType)}`}>{s.paymentType.toUpperCase()}{s.isDiscounted ? " · DISC" : ""} · {format(new Date(s.createdAt), "d MMM")}</Text>
                  </View>
                  <Text className="text-stone-900 font-bold">{s.paymentType === "free" ? "₹0" : `₹${s.totalValue}`}</Text>
                </View>
              ))}
              {sales.length === 0 && <Text className="text-stone-500 text-sm">No sales.</Text>}
            </View>

            <Text className="text-stone-900 text-lg font-bold mb-sm">Remittances</Text>
            <View className="gap-sm">
              {remits.map((r) => (
                <View key={r.id} className="flex-row justify-between rounded-xl bg-white border border-stone-200 p-md">
                  <Text className="text-stone-500 text-xs flex-1">{r.note || "No note"} · {format(new Date(r.createdAt), "d MMM")}</Text>
                  <Text className="text-emerald-700 font-bold">₹{r.amount}</Text>
                </View>
              ))}
              {remits.length === 0 && <Text className="text-stone-500 text-sm">No remittances.</Text>}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

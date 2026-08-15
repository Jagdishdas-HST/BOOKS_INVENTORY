
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import {
  ChevronLeft, Building2, User as UserIcon, Phone, Mail, MapPin,
  BookOpen, Receipt, Gift, ShoppingCart,
} from "lucide-react-native";
import { format } from "date-fns";
import { authFetch, useAuth } from "@/lib/auth";
import { Skeleton, EmptyState, StatCard } from "@/components/ui";

export default function CustomerDetail() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const isDistributor = user?.role === "distributor";
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await authFetch(`/api/customers/${id}`));
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const inr = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`;
  const c = data?.customer;

  const badge = (t: string) =>
    t === "cash" ? "bg-emerald-100 text-emerald-700"
    : t === "online" ? "bg-sky-100 text-sky-700"
    : t === "free" ? "bg-purple-100 text-purple-700"
    : "bg-rose-100 text-rose-700";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold flex-1" numberOfLines={1}>
          {c?.name || "Customer"}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-lg pb-3xl"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}
      >
        {loading ? (
          <Skeleton count={5} />
        ) : !data ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState icon={<UserIcon size={26} color="#a8a29e" />} title="Not found" description="This customer could not be loaded." />
          </View>
        ) : (
          <>
            {/* Header card */}
            <View className="rounded-2xl bg-white border border-stone-200 p-lg">
              <View className="flex-row items-center gap-sm">
                <View className={`w-12 h-12 rounded-full items-center justify-center ${c.type === "institute" ? "bg-indigo-100" : "bg-amber-100"}`}>
                  {c.type === "institute"
                    ? <Building2 size={22} color="#4f46e5" />
                    : <UserIcon size={22} color="#d97706" />}
                </View>
                <View className="flex-1">
                  <Text className="text-stone-900 text-lg font-bold" numberOfLines={1}>{c.name}</Text>
                  <Text className="text-stone-500 text-xs">
                    {c.type === "institute" ? "Institute" : "Individual"}
                    {c.contactPerson ? ` · ${c.contactPerson}` : ""}
                  </Text>
                </View>
              </View>

              {(c.phone || c.email || c.address) && (
                <View className="mt-md gap-xs">
                  {c.phone ? (
                    <View className="flex-row items-center gap-xs">
                      <Phone size={14} color="#78716c" /><Text className="text-stone-600 text-sm">{c.phone}</Text>
                    </View>
                  ) : null}
                  {c.email ? (
                    <View className="flex-row items-center gap-xs">
                      <Mail size={14} color="#78716c" /><Text className="text-stone-600 text-sm">{c.email}</Text>
                    </View>
                  ) : null}
                  {c.address ? (
                    <View className="flex-row items-start gap-xs">
                      <MapPin size={14} color="#78716c" /><Text className="text-stone-600 text-sm flex-1">{c.address}</Text>
                    </View>
                  ) : null}
                </View>
              )}
              {c.note ? (
                <View className="mt-md rounded-lg bg-stone-50 border border-stone-200 p-sm">
                  <Text className="text-stone-600 text-sm">{c.note}</Text>
                </View>
              ) : null}
            </View>

            {/* Summary */}
            <View className="flex-row gap-sm mt-md">
              <StatCard label="Copies" value={String(data.summary.totalCopies)} tone="neutral" />
              <StatCard label="Total Value" value={inr(data.summary.totalValue)} tone="success" />
              <StatCard label="Orders" value={String(data.summary.orderCount)} tone="neutral" />
            </View>

            {isDistributor && (
              <Pressable
                onPress={() => router.push({ pathname: "/sale/new", params: { customerId: String(c.id), customerName: c.name } })}
                accessibilityLabel="Deliver books to this customer"
                className="flex-row items-center justify-center gap-sm rounded-xl bg-amber-600 py-md mt-md active:opacity-80"
              >
                <ShoppingCart size={18} color="#fff" />
                <Text className="text-white font-semibold">Deliver Books to {c.type === "institute" ? "Institute" : "Customer"}</Text>
              </Pressable>
            )}

            <Text className="text-stone-900 text-lg font-bold mt-xl mb-sm">
              Purchase History ({data.purchases.length})
            </Text>

            {data.purchases.length === 0 ? (
              <View className="rounded-xl bg-white border border-stone-200">
                <EmptyState
                  icon={<Receipt size={24} color="#a8a29e" />}
                  title="No purchases yet"
                  description="Books delivered to this customer will show up here."
                />
              </View>
            ) : (
              <View className="gap-sm">
                {data.purchases.map((p: any) => (
                  <View key={p.id} className="flex-row items-center rounded-xl bg-white border border-stone-200 p-md">
                    {p.coverUrl ? (
                      <Image source={p.coverUrl} style={{ width: 38, height: 52, borderRadius: 6 }} contentFit="cover" />
                    ) : (
                      <View className="rounded-md bg-stone-100 items-center justify-center" style={{ width: 38, height: 52 }}>
                        <BookOpen size={16} color="#d6d3d1" />
                      </View>
                    )}
                    <View className="flex-1 ml-sm">
                      <Text className="text-stone-900 font-semibold" numberOfLines={1}>{p.bookTitle}</Text>
                      <View className="flex-row items-center gap-sm mt-xs">
                        <View className={`rounded-full px-sm py-[2px] flex-row items-center gap-xs ${badge(p.paymentType)}`}>
                          {p.paymentType === "free" && <Gift size={11} color="#7c3aed" />}
                          <Text className={`text-xs font-semibold ${badge(p.paymentType).split(" ")[1]}`}>
                            {p.paymentType.toUpperCase()}
                          </Text>
                        </View>
                        <Text className="text-stone-500 text-xs">{p.quantity} × ₹{p.unitPrice}</Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="text-stone-900 font-extrabold">
                        {p.paymentType === "free" ? "₹0" : inr(p.totalValue)}
                      </Text>
                      <Text className="text-stone-400 text-xs mt-xs">{format(new Date(p.createdAt), "d MMM")}</Text>
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

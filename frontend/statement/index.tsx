
import { useState, useCallback } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Platform, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronLeft, FileText, FileDown, Gift } from "lucide-react-native";
import { format } from "date-fns";
import { authFetch, useAuth } from "@/lib/auth";
import { API_URL } from "@/constants/api";
import { Button, Skeleton, EmptyState, StatCard } from "@/components/ui";

export default function StatementScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const params = useLocalSearchParams<{ distributorId?: string; name?: string }>();
  const isAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";
  const distId = params.distributorId ? Number(params.distributorId) : user?.id;
  const distName = params.name || user?.name || "You";

  const today = new Date();
  const monthAgo = new Date(Date.now() - 30 * 86400000);
  const [from, setFrom] = useState(format(monthAgo, "yyyy-MM-dd"));
  const [to, setTo] = useState(format(today, "yyyy-MM-dd"));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const qs = useCallback(() => {
    const parts = [`from=${from}`, `to=${to}`];
    if (isAdmin && params.distributorId) parts.push(`distributorId=${distId}`);
    return parts.join("&");
  }, [from, to, isAdmin, params.distributorId, distId]);

  const generate = async () => {
    setError(""); setLoading(true);
    try {
      const d = await authFetch(`/api/statements?${qs()}`);
      setData(d);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const openExport = async (fmt: "pdf" | "csv") => {
    const token = await AsyncStorage.getItem("authToken");
    // Attach token as a query param so browser navigation carries auth.
    const url = `${API_URL}/api/statements/${fmt}?${qs()}&token=${token}`;
    if (Platform.OS === "web") {
      Linking.openURL(url);
    } else {
      await WebBrowser.openBrowserAsync(url);
    }
  };

  const inr = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold flex-1">Statement</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        <Text className="text-stone-500 text-sm mb-md">{distName} · choose a date range</Text>

        <View className="flex-row gap-sm">
          <View className="flex-1">
            <Text className="text-stone-600 text-sm font-medium mb-xs">From</Text>
            <TextInput value={from} onChangeText={setFrom} placeholder="2025-01-01" placeholderTextColor="#a8a29e"
              className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
          </View>
          <View className="flex-1">
            <Text className="text-stone-600 text-sm font-medium mb-xs">To</Text>
            <TextInput value={to} onChangeText={setTo} placeholder="2025-01-31" placeholderTextColor="#a8a29e"
              className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
          </View>
        </View>

        <View className="mt-md">
          <Button label="Generate Statement" onPress={generate} loading={loading} />
        </View>

        {error ? <Text className="text-rose-600 text-sm mt-sm">{error}</Text> : null}

        {loading ? (
          <View className="mt-lg"><Skeleton count={4} /></View>
        ) : data ? (
          <>
            <View className="flex-row gap-sm mt-lg">
              <StatCard label="Opening" value={inr(data.openingOutstanding)} tone={data.openingOutstanding > 0 ? "danger" : "neutral"} />
              <StatCard label="Closing" value={inr(data.closingOutstanding)} tone={data.closingOutstanding > 0 ? "danger" : "success"} />
            </View>

            <Text className="text-stone-900 text-lg font-bold mt-xl mb-sm">Sales by Payment Type</Text>
            <View className="gap-sm">
              {(["cash", "online", "debt"] as const).map((k) => (
                <View key={k} className="flex-row justify-between rounded-xl bg-white border border-stone-200 p-md">
                  <Text className="text-stone-700 font-medium">{k.toUpperCase()} · {data.byType[k].copies} copies</Text>
                  <Text className="text-stone-900 font-bold">{inr(data.byType[k].value)}</Text>
                </View>
              ))}
              <View className="flex-row justify-between items-center rounded-xl bg-purple-50 border border-purple-200 p-md">
                <View className="flex-row items-center gap-sm">
                  <Gift size={16} color="#7c3aed" />
                  <Text className="text-purple-800 font-medium">FREE · {data.byType.free.copies} copies</Text>
                </View>
                <Text className="text-purple-800 font-bold">₹0</Text>
              </View>
              <View className="flex-row justify-between rounded-xl bg-orange-50 border border-orange-200 p-md">
                <Text className="text-orange-800 font-medium">Discounted sales value</Text>
                <Text className="text-orange-800 font-bold">{inr(data.discountedValue)}</Text>
              </View>
            </View>

            <View className="flex-row justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-md mt-sm">
              <Text className="text-emerald-800 font-medium">Remittances in period</Text>
              <Text className="text-emerald-800 font-bold">{inr(data.remitTotal)}</Text>
            </View>

            <Text className="text-stone-900 text-lg font-bold mt-xl mb-sm">Sales Lines ({data.sales.length})</Text>
            {data.sales.length === 0 ? (
              <View className="rounded-xl bg-white border border-stone-200">
                <EmptyState icon={<FileText size={24} color="#a8a29e" />} title="No sales" description="No sales in this range." />
              </View>
            ) : (
              <View className="gap-sm">
                {data.sales.map((s: any) => (
                  <View key={s.id} className="rounded-xl bg-white border border-stone-200 p-md">
                    <View className="flex-row justify-between">
                      <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{s.bookTitle}</Text>
                      <Text className="text-stone-900 font-bold">{s.paymentType === "free" ? "₹0" : inr(s.totalValue)}</Text>
                    </View>
                    <Text className="text-stone-500 text-xs mt-xs">
                      {s.quantity} × ₹{s.unitPrice} · {s.paymentType.toUpperCase()}{s.isDiscounted ? " · DISCOUNTED" : ""} · {format(new Date(s.createdAt), "d MMM")}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text className="text-stone-900 text-lg font-bold mt-xl mb-sm">Export</Text>
            <View className="flex-row gap-sm">
              <Pressable onPress={() => openExport("pdf")} accessibilityLabel="Export PDF"
                className="flex-1 flex-row items-center justify-center gap-sm rounded-xl bg-stone-900 py-md active:opacity-80">
                <FileDown size={18} color="#fff" />
                <Text className="text-white font-semibold">PDF</Text>
              </Pressable>
              <Pressable onPress={() => openExport("csv")} accessibilityLabel="Export CSV"
                className="flex-1 flex-row items-center justify-center gap-sm rounded-xl bg-stone-200 py-md active:opacity-70">
                <FileDown size={18} color="#292524" />
                <Text className="text-stone-900 font-semibold">CSV</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

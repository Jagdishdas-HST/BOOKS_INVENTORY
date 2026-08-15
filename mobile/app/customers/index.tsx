
import { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, TextInput, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  Search as SearchIcon, Plus, Building2, User as UserIcon,
  ChevronRight, Users, WifiOff,
} from "lucide-react-native";
import { format } from "date-fns";
import { authFetch } from "@/lib/auth";
import { Skeleton, EmptyState } from "@/components/ui";
import { useIsOnline, startConnectivityPolling } from "@/lib/connectivity";

type CustomerRow = {
  id: number;
  name: string;
  type: "institute" | "individual";
  contactPerson: string | null;
  phone: string | null;
  totalCopies: number;
  totalValue: number;
  lastPurchaseAt: string | null;
};

export default function CustomersScreen() {
  const router = useRouter();
  const online = useIsOnline();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const timer = useRef<any>(null);

  const load = useCallback(async (query = "") => {
    if (!online) { setLoading(false); return; }
    try {
      const data = await authFetch(`/api/customers${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
      setRows(data);
    } catch {}
    setLoading(false);
    setSearching(false);
  }, [online]);

  useEffect(() => { startConnectivityPolling(); }, []);

  useFocusEffect(useCallback(() => { load(q); }, [load]));

  const onChange = (t: string) => {
    setQ(t);
    setSearching(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load(t), 300);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(q);
    setRefreshing(false);
  };

  const inr = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center justify-between px-lg pt-md pb-sm">
        <View>
          <Text className="text-stone-900 text-2xl font-extrabold">Customers</Text>
          <Text className="text-stone-500 text-xs mt-xs">Institutes & individual buyers</Text>
        </View>
        <Pressable
          onPress={() => router.push("/customer/new")}
          accessibilityLabel="Add customer"
          className="flex-row items-center gap-xs px-md py-sm rounded-full bg-amber-600 active:opacity-80"
        >
          <Plus size={16} color="#fff" />
          <Text className="text-white text-sm font-semibold">Add</Text>
        </Pressable>
      </View>

      {!online && (
        <View className="mx-lg mb-sm rounded-xl bg-amber-50 border border-amber-200 p-md flex-row items-center gap-sm">
          <WifiOff size={16} color="#d97706" />
          <Text className="text-amber-800 text-sm flex-1">
            Customers require a connection. Reconnect to view your list.
          </Text>
        </View>
      )}

      <View className="px-lg pb-sm">
        <View className="flex-row items-center rounded-xl bg-white border border-stone-200 px-md">
          <SearchIcon size={18} color="#a8a29e" />
          <TextInput
            value={q}
            onChangeText={onChange}
            placeholder="Search by name, contact or phone…"
            placeholderTextColor="#a8a29e"
            className="flex-1 px-sm py-md text-stone-900"
            editable={online}
          />
          {searching && <ActivityIndicator size="small" color="#d97706" />}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-lg pb-3xl pt-sm"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <Skeleton count={5} />
        ) : rows.length === 0 ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState
              icon={<Users size={26} color="#a8a29e" />}
              title={q.trim() ? "No matches" : "No customers yet"}
              description={q.trim() ? `Nothing found for "${q.trim()}".` : "Add an institute or individual buyer to start tracking their book history."}
            />
          </View>
        ) : (
          <View className="gap-sm">
            {rows.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: "/customer/[id]", params: { id: String(c.id) } })}
                className="flex-row items-center rounded-xl bg-white border border-stone-200 p-md active:opacity-80"
              >
                <View className={`w-11 h-11 rounded-full items-center justify-center ${c.type === "institute" ? "bg-indigo-100" : "bg-amber-100"}`}>
                  {c.type === "institute"
                    ? <Building2 size={20} color="#4f46e5" />
                    : <UserIcon size={20} color="#d97706" />}
                </View>
                <View className="flex-1 ml-sm">
                  <Text className="text-stone-900 font-semibold" numberOfLines={1}>{c.name}</Text>
                  <Text className="text-stone-500 text-xs mt-xs">
                    {c.totalCopies} copies · {inr(c.totalValue)}
                    {c.lastPurchaseAt ? ` · last ${format(new Date(c.lastPurchaseAt), "d MMM")}` : ""}
                  </Text>
                </View>
                <ChevronRight size={18} color="#a8a29e" />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

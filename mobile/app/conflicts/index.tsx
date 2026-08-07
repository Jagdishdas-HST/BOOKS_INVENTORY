
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, AlertTriangle, Check, X, Gift } from "lucide-react-native";
import { format } from "date-fns";
import { useAuth, authFetch } from "@/lib/auth";
import { Skeleton, EmptyState, Chip } from "@/components/ui";
import { haptics } from "@/lib/haptics";

type Conflict = {
  id: number;
  quantity: number;
  unitPrice: string;
  totalValue: string;
  paymentType: string;
  isDiscounted: boolean;
  heldAtSync: number;
  clientLoggedAt: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  bookTitle: string;
  distributorName: string;
};

export default function Conflicts() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const [rows, setRows] = useState<Conflict[]>([]);
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const isAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";

  useEffect(() => {
    if (hydrated && !isAdmin) router.replace("/(tabs)");
  }, [hydrated, isAdmin]);

  const load = useCallback(async () => {
    try {
      const data = await authFetch(`/api/conflicts?status=${statusFilter}`);
      setRows(data);
    } catch {}
    setLoading(false);
  }, [statusFilter]);
  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const resolve = async (id: number, decision: "approved" | "rejected") => {
    setBusy(id);
    try {
      await authFetch(`/api/conflicts/${id}/resolve`, { method: "POST", body: JSON.stringify({ decision }) });
      haptics.success();
      await load();
    } catch {} finally { setBusy(null); }
  };

  if (!isAdmin) return null;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center gap-sm px-lg pt-md pb-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Sync Conflicts</Text>
      </View>

      <View className="py-xs">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg gap-sm">
          <Chip label="Pending" active={statusFilter === "pending"} onPress={() => setStatusFilter("pending")} />
          <Chip label="All" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl pt-sm" showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}>
        {loading ? <Skeleton count={4} /> : rows.length === 0 ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState icon={<AlertTriangle size={26} color="#a8a29e" />} title="No conflicts" description="Queued offline sales that fail a stock re-check will appear here for review." />
          </View>
        ) : (
          <View className="gap-sm">
            {rows.map((c) => (
              <View key={c.id} className="rounded-xl bg-white border border-stone-200 p-md">
                <View className="flex-row items-center justify-between">
                  <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{c.bookTitle}</Text>
                  <Text className="text-stone-900 font-extrabold">{c.paymentType === "free" ? "₹0" : `₹${c.totalValue}`}</Text>
                </View>
                <Text className="text-stone-500 text-xs mt-xs">{c.distributorName} · {c.quantity} × ₹{c.unitPrice}{c.paymentType === "free" ? " (free)" : ` (${c.paymentType})`}</Text>

                <View className="rounded-lg bg-rose-50 border border-rose-200 p-sm mt-sm">
                  <View className="flex-row items-center gap-xs">
                    <AlertTriangle size={13} color="#e11d48" />
                    <Text className="text-rose-700 text-xs font-semibold flex-1">Wanted {c.quantity}, held only {c.heldAtSync} at sync time</Text>
                  </View>
                </View>

                <Text className="text-stone-400 text-xs mt-sm">
                  Logged in field {c.clientLoggedAt ? format(new Date(c.clientLoggedAt), "d MMM, h:mm a") : "—"} · reached server {format(new Date(c.createdAt), "d MMM, h:mm a")}
                </Text>

                {c.status === "pending" ? (
                  <View className="flex-row gap-sm mt-md">
                    <Pressable disabled={busy === c.id} onPress={() => resolve(c.id, "approved")} accessibilityLabel="Approve sale"
                      className="flex-1 flex-row items-center justify-center gap-xs rounded-xl bg-amber-600 py-sm active:opacity-80">
                      <Check size={15} color="#fff" />
                      <Text className="text-white text-sm font-semibold">Approve</Text>
                    </Pressable>
                    <Pressable disabled={busy === c.id} onPress={() => resolve(c.id, "rejected")} accessibilityLabel="Reject sale"
                      className="flex-1 flex-row items-center justify-center gap-xs rounded-xl bg-stone-200 py-sm active:opacity-70">
                      <X size={15} color="#292524" />
                      <Text className="text-stone-900 text-sm font-semibold">Drop</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View className={`self-start rounded-full px-sm py-[2px] mt-md ${c.status === "approved" ? "bg-emerald-100" : "bg-stone-200"}`}>
                    <Text className={`text-xs font-semibold ${c.status === "approved" ? "text-emerald-700" : "text-stone-600"}`}>
                      {c.status === "approved" ? "APPROVED — forced through" : "DROPPED"}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

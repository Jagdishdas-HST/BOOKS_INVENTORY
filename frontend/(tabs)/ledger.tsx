
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  Receipt, HandCoins, FileText, Gift,
  CloudUpload, AlertTriangle, RefreshCw, Clock, CheckCircle2, WifiOff, Check,
} from "lucide-react-native";
import { format } from "date-fns";
import { authFetch } from "@/lib/auth";
import { Skeleton, EmptyState, Chip } from "@/components/ui";
import { useOfflineQueue, type QueueStatus } from "@/lib/offlineQueue";
import { useIsOnline, startConnectivityPolling } from "@/lib/connectivity";

// Accurate status badge — cycles through all 4 states: queued, syncing, synced (removed from queue), flagged
function QueueStatusBadge({ status }: { status: QueueStatus }) {
  if (status === "conflict") {
    return (
      <View className="flex-row items-center gap-xs">
        <AlertTriangle size={13} color="#e11d48" />
        <Text className="text-rose-700 text-xs font-semibold">Flagged for review</Text>
      </View>
    );
  }
  if (status === "syncing") {
    return (
      <View className="flex-row items-center gap-xs">
        <RefreshCw size={13} color="#d97706" />
        <Text className="text-amber-700 text-xs font-semibold">Syncing…</Text>
      </View>
    );
  }
  // "pending" = queued, waiting for connection
  return (
    <View className="flex-row items-center gap-xs">
      <CloudUpload size={13} color="#d97706" />
      <Text className="text-amber-700 text-xs font-semibold">Queued — pending sync</Text>
    </View>
  );
}

export default function Ledger() {
  const router = useRouter();
  const online = useIsOnline();
  const [tab, setTab] = useState<"sales" | "remittances">("sales");
  const [sales, setSales] = useState<any[]>([]);
  const [remits, setRemits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const queue = useOfflineQueue((s) => s.items);
  const refreshQueue = useOfflineQueue((s) => s.refresh);
  const syncQueue = useOfflineQueue((s) => s.sync);
  const syncing = useOfflineQueue((s) => s.syncing);

  useEffect(() => {
    startConnectivityPolling();
  }, []);

  const load = useCallback(async () => {
    if (!online) { setLoading(false); return; }
    try {
      const [s, r] = await Promise.all([authFetch("/api/sales"), authFetch("/api/remittances")]);
      setSales(s);
      setRemits(r);
    } catch {}
    setLoading(false);
  }, [online]);

  useEffect(() => {
    load();
    refreshQueue();
    // Auto-sync when coming online
    if (online) syncQueue();
  }, [load, online]);

  const onRefresh = async () => {
    setRefreshing(true);
    await syncQueue();
    await refreshQueue();
    await load();
    setRefreshing(false);
  };

  const badge = (t: string) =>
    t === "cash" ? "bg-emerald-100 text-emerald-700"
    : t === "online" ? "bg-sky-100 text-sky-700"
    : t === "free" ? "bg-purple-100 text-purple-700"
    : "bg-rose-100 text-rose-700";

  const pending = queue.filter((q) => q.status === "pending");
  const syncingItems = queue.filter((q) => q.status === "syncing");
  const conflicts = queue.filter((q) => q.status === "conflict");
  const totalQueued = pending.length + syncingItems.length + conflicts.length;

  // Summary label for the header — shows the most urgent state
  const queueSummaryLabel = () => {
    if (conflicts.length > 0 && (pending.length + syncingItems.length) === 0) {
      return `${conflicts.length} sale${conflicts.length === 1 ? "" : "s"} flagged for review`;
    }
    if (syncing || syncingItems.length > 0) {
      return `Syncing ${syncingItems.length + pending.length} sale${(syncingItems.length + pending.length) === 1 ? "" : "s"}…`;
    }
    if (pending.length > 0) {
      return `${pending.length} sale${pending.length === 1 ? "" : "s"} queued — waiting for connection`;
    }
    return null;
  };

  const summaryLabel = queueSummaryLabel();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center justify-between px-lg pt-md pb-sm">
        <View>
          <Text className="text-stone-900 text-2xl font-extrabold">My Ledger</Text>
          {summaryLabel && (
            <Text className={`text-xs font-semibold mt-xs ${conflicts.length > 0 && pending.length === 0 ? "text-rose-700" : "text-amber-700"}`}>
              {summaryLabel}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => { if (online) router.push("/statement"); }}
          accessibilityLabel="My statement"
          className={`flex-row items-center gap-xs px-md py-sm rounded-full ${online ? "bg-stone-900 active:opacity-80" : "bg-stone-300"}`}
        >
          <FileText size={16} color="#fff" />
          <Text className="text-white text-sm font-semibold">Statement</Text>
        </Pressable>
      </View>

      <View className="py-xs">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg gap-sm">
          <Chip label="Sales" active={tab === "sales"} onPress={() => setTab("sales")} />
          <Chip label="Remittances" active={tab === "remittances"} onPress={() => setTab("remittances")} />
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-lg pb-3xl pt-sm"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}
      >
        {/* Offline notice */}
        {!online && (
          <View className="rounded-xl bg-amber-50 border border-amber-200 p-md mb-md flex-row items-center gap-sm">
            <WifiOff size={16} color="#d97706" />
            <Text className="text-amber-800 text-sm flex-1">
              Offline — synced sales shown below. New sales are queued locally.
            </Text>
          </View>
        )}

        {/* Statement requires connection */}
        {!online && tab === "remittances" && (
          <View className="rounded-xl bg-stone-100 border border-stone-200 p-md mb-md flex-row items-center gap-sm">
            <WifiOff size={14} color="#78716c" />
            <Text className="text-stone-600 text-sm flex-1">
              Remittance history requires a connection.
            </Text>
          </View>
        )}

        {/* Sync status header — shows all 4 states */}
        {tab === "sales" && totalQueued > 0 ? (
          <View className="mb-md gap-sm">
            <View className="flex-row items-center justify-between">
              <Text className="text-stone-500 text-xs uppercase tracking-wide">Offline Queue</Text>
              <Pressable
                onPress={onRefresh}
                accessibilityLabel="Sync now"
                className="flex-row items-center gap-xs active:opacity-70"
              >
                <RefreshCw size={13} color="#d97706" />
                <Text className="text-amber-700 text-xs font-semibold">
                  {syncing ? "Syncing…" : online ? "Sync now" : "Offline"}
                </Text>
              </Pressable>
            </View>

            {/* FLAGGED FOR REVIEW — conflict state */}
            {conflicts.map((q) => (
              <View key={q.clientId} className="rounded-xl bg-rose-50 border border-rose-200 p-md">
                <View className="flex-row items-center justify-between">
                  <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{q.bookTitle}</Text>
                  <Text className="text-stone-900 font-extrabold">
                    {q.paymentType === "free" ? "₹0" : `₹${q.totalValue.toFixed(2)}`}
                  </Text>
                </View>
                <QueueStatusBadge status="conflict" />
                <Text className="text-stone-400 text-xs mt-xs">
                  Logged {format(new Date(q.clientLoggedAt), "d MMM, h:mm a")} · {q.quantity} × ₹{q.unitPrice}
                </Text>
                <Text className="text-stone-500 text-xs mt-xs">
                  Stock was insufficient at sync time. An Admin/Manager will approve or drop it.
                </Text>
              </View>
            ))}

            {/* SYNCING — in-progress state */}
            {syncingItems.map((q) => (
              <View key={q.clientId} className="rounded-xl bg-sky-50 border border-sky-200 p-md">
                <View className="flex-row items-center justify-between">
                  <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{q.bookTitle}</Text>
                  <Text className="text-stone-900 font-extrabold">
                    {q.paymentType === "free" ? "₹0" : `₹${q.totalValue.toFixed(2)}`}
                  </Text>
                </View>
                <QueueStatusBadge status="syncing" />
                <Text className="text-stone-400 text-xs mt-xs">
                  {q.quantity} × ₹{q.unitPrice} · {q.paymentType.toUpperCase()}
                </Text>
              </View>
            ))}

            {/* QUEUED — pending state */}
            {pending.map((q) => (
              <View key={q.clientId} className="rounded-xl bg-amber-50 border border-amber-200 p-md">
                <View className="flex-row items-center justify-between">
                  <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{q.bookTitle}</Text>
                  <Text className="text-stone-900 font-extrabold">
                    {q.paymentType === "free" ? "₹0" : `₹${q.totalValue.toFixed(2)}`}
                  </Text>
                </View>
                <View className="flex-row items-center gap-xs mt-xs">
                  <QueueStatusBadge status={q.status} />
                  <Text className="text-stone-400 text-xs">
                    · logged {format(new Date(q.clientLoggedAt), "d MMM, h:mm a")}
                  </Text>
                </View>
                <Text className="text-stone-400 text-xs mt-xs">
                  {q.quantity} × ₹{q.unitPrice} · {q.paymentType.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* SYNCED sales — shown after queue is empty or alongside it */}
        {loading ? (
          <Skeleton count={5} />
        ) : tab === "sales" ? (
          sales.length === 0 && totalQueued === 0 ? (
            <View className="rounded-xl bg-white border border-stone-200 mt-lg">
              <EmptyState
                icon={<Receipt size={26} color="#a8a29e" />}
                title="No sales logged"
                description="Log your first sale from the Home tab."
              />
            </View>
          ) : (
            <View className="gap-sm">
              {sales.length > 0 && (
                <View className="flex-row items-center gap-xs mb-xs">
                  <CheckCircle2 size={14} color="#059669" />
                  <Text className="text-stone-500 text-xs uppercase tracking-wide">Synced sales</Text>
                </View>
              )}
              {sales.map((s) => (
                <View key={s.id} className="rounded-xl bg-white border border-stone-200 p-md">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{s.bookTitle}</Text>
                    <View className="flex-row items-center gap-xs">
                      <Check size={12} color="#059669" />
                      <Text className="text-stone-900 font-extrabold">
                        {s.paymentType === "free" ? "₹0" : `₹${s.totalValue}`}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between mt-xs">
                    <View className="flex-row items-center gap-sm">
                      <View className={`rounded-full px-sm py-[2px] flex-row items-center gap-xs ${badge(s.paymentType)}`}>
                        {s.paymentType === "free" && <Gift size={11} color="#7c3aed" />}
                        <Text className={`text-xs font-semibold ${badge(s.paymentType).split(" ")[1]}`}>
                          {s.paymentType.toUpperCase()}
                        </Text>
                      </View>
                      {s.isDiscounted ? (
                        <View className="rounded-full bg-orange-100 px-sm py-[2px]">
                          <Text className="text-orange-700 text-xs font-semibold">DISCOUNTED</Text>
                        </View>
                      ) : null}
                      <Text className="text-stone-500 text-xs">{s.quantity} × ₹{s.unitPrice}</Text>
                    </View>
                    <Text className="text-stone-400 text-xs">{format(new Date(s.createdAt), "d MMM, h:mm a")}</Text>
                  </View>
                  {s.clientLoggedAt && new Date(s.clientLoggedAt).getTime() < new Date(s.createdAt).getTime() - 60000 ? (
                    <View className="flex-row items-center gap-xs mt-xs">
                      <Clock size={11} color="#a8a29e" />
                      <Text className="text-stone-400 text-xs">
                        Logged offline {format(new Date(s.clientLoggedAt), "d MMM, h:mm a")} · synced {format(new Date(s.createdAt), "h:mm a")}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )
        ) : (
          remits.length === 0 ? (
            <View className="rounded-xl bg-white border border-stone-200 mt-lg">
              <EmptyState
                icon={<HandCoins size={26} color="#a8a29e" />}
                title="No remittances"
                description={online ? "Log a payment to reduce your outstanding balance." : "Connect to view remittance history."}
              />
            </View>
          ) : (
            <View className="gap-sm">
              {remits.map((r) => (
                <View key={r.id} className="flex-row items-center justify-between rounded-xl bg-white border border-stone-200 p-md">
                  <View className="flex-1">
                    <Text className="text-stone-900 font-semibold">₹{r.amount}</Text>
                    <Text className="text-stone-500 text-xs">
                      {r.note || "No note"} · {format(new Date(r.createdAt), "d MMM, h:mm a")}
                    </Text>
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

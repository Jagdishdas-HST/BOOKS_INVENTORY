
import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  PackagePlus,
  Undo2,
  ClipboardCheck,
  History,
  Boxes,
  AlertTriangle,
  Package,
} from "lucide-react-native";
import { API_URL } from "@/constants/api";
import { getAuth, authFetch, type Role } from "@/lib/auth";

type Movement = {
  id: number;
  quantity: number;
  type: string;
  reason: string | null;
  createdAt: string;
  bookTitle: string;
  distributorName: string | null;
  toDistributorId: number | null;
  toDistributorName: string | null;
};

type Holding = {
  id: number;
  bookId: number;
  quantity: number;
  title: string;
  sku: string;
  category: string;
  language: string;
  retailPrice: string;
  coverUrl: string | null;
  isbn: string | null;
};

const MANAGER_ROLES: Role[] = ["super_admin", "inventory_manager"];

function movementLabel(type: string): string {
  switch (type) {
    case "assign":
      return "Assigned";
    case "transfer":
      return "Transferred";
    case "stock_in":
      return "Intake";
    case "return":
      return "Returned";
    case "adjust":
      return "Reconciled";
    default:
      return type;
  }
}

export default function StockScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [movements, setMovements] = useState<Movement[] | null>(null);
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isManager = role !== null && MANAGER_ROLES.includes(role);

  const load = useCallback(async () => {
    const auth = await getAuth();
    const currentRole = auth?.role ?? null;
    setRole(currentRole);

    try {
      if (currentRole && MANAGER_ROLES.includes(currentRole)) {
        // Only managers are permitted to read movement history — fetching this
        // as a distributor returns 403 FORBIDDEN by design.
        const res = await authFetch(`${API_URL}/api/stock/movements`);
        if (res.ok) {
          setMovements(await res.json());
        } else {
          setMovements([]);
        }
      } else {
        // Distributors see their own holdings (public endpoint), not movements.
        const res = await authFetch(`${API_URL}/api/stock/holdings`);
        if (res.ok) {
          setHoldings(await res.json());
        } else {
          setHoldings([]);
        }
      }
    } catch {
      setMovements([]);
      setHoldings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const actions = [
    { key: "intake", label: "Stock Intake", icon: PackagePlus, href: "/stock/intake" },
    { key: "assign", label: "Assign", icon: ArrowDownToLine, href: "/stock/assign" },
    { key: "transfer", label: "Transfer", icon: ArrowLeftRight, href: "/stock/transfer" },
    { key: "return", label: "Return", icon: Undo2, href: "/stock/return" },
    { key: "reconcile", label: "Reconcile", icon: ClipboardCheck, href: "/stock/reconcile" },
  ] as const;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-slate-50">
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-3xl"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View className="px-lg pt-md pb-lg">
          <Text className="text-slate-900 text-2xl font-bold">Stock</Text>
          <Text className="text-slate-500 text-sm mt-xs">
            {isManager ? "Warehouse & distributor movements" : "Your assigned inventory"}
          </Text>
        </View>

        {/* Manager-only quick actions */}
        {isManager && (
          <View className="px-lg">
            <View className="flex-row flex-wrap gap-sm">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <Pressable
                    key={a.key}
                    accessibilityLabel={a.label}
                    onPress={() => router.push(a.href)}
                    className="w-[31%] rounded-xl bg-white border border-slate-200 p-md items-center active:opacity-80"
                  >
                    <View className="w-10 h-10 rounded-full bg-indigo-50 items-center justify-center mb-xs">
                      <Icon size={18} color="#4f46e5" />
                    </View>
                    <Text className="text-slate-900 text-xs font-semibold text-center">{a.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <View className="px-lg mt-xl gap-sm">
            <View className="h-16 rounded-xl bg-slate-200" />
            <View className="h-16 rounded-xl bg-slate-200" />
            <View className="h-16 rounded-xl bg-slate-200" />
          </View>
        ) : isManager ? (
          /* Manager: movement history */
          <View className="px-lg mt-xl">
            <View className="flex-row items-center gap-xs mb-sm">
              <History size={18} color="#0f172a" />
              <Text className="text-slate-900 text-lg font-bold">Recent Movements</Text>
            </View>

            {movements && movements.length > 0 ? (
              <View className="gap-sm">
                {movements.map((m) => (
                  <View
                    key={m.id}
                    className="flex-row items-center justify-between rounded-xl bg-white border border-slate-200 p-md"
                  >
                    <View className="flex-row items-center gap-sm flex-1">
                      <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center">
                        <Boxes size={18} color="#475569" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-slate-900 font-semibold" numberOfLines={1}>
                          {m.bookTitle}
                        </Text>
                        <Text className="text-slate-500 text-xs" numberOfLines={1}>
                          {movementLabel(m.type)}
                          {m.distributorName ? ` · ${m.distributorName}` : ""}
                          {m.toDistributorName ? ` → ${m.toDistributorName}` : ""}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-slate-900 font-bold ml-sm">
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center justify-center py-2xl rounded-xl bg-white border border-slate-200">
                <History size={28} color="#94a3b8" />
                <Text className="text-slate-900 font-semibold mt-sm">No movements yet</Text>
                <Text className="text-slate-500 text-sm mt-xs text-center px-lg">
                  Stock activity will appear here once you record intake or assignments.
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* Distributor: own holdings */
          <View className="px-lg mt-xl">
            <View className="flex-row items-center gap-xs mb-sm">
              <Package size={18} color="#0f172a" />
              <Text className="text-slate-900 text-lg font-bold">My Holdings</Text>
            </View>

            {holdings && holdings.length > 0 ? (
              <View className="gap-sm">
                {holdings.map((h) => (
                  <View
                    key={h.id}
                    className="flex-row items-center justify-between rounded-xl bg-white border border-slate-200 p-md"
                  >
                    <View className="flex-row items-center gap-sm flex-1">
                      <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center">
                        <Boxes size={18} color="#475569" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-slate-900 font-semibold" numberOfLines={1}>
                          {h.title}
                        </Text>
                        <Text className="text-slate-500 text-xs" numberOfLines={1}>
                          {h.category} · {h.language}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end ml-sm">
                      <Text className="text-slate-900 font-bold">{h.quantity}</Text>
                      <Text className="text-slate-400 text-xs">in stock</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center justify-center py-2xl rounded-xl bg-white border border-slate-200">
                <AlertTriangle size={28} color="#94a3b8" />
                <Text className="text-slate-900 font-semibold mt-sm">No stock assigned</Text>
                <Text className="text-slate-500 text-sm mt-xs text-center px-lg">
                  Books assigned to you by a manager will appear here.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

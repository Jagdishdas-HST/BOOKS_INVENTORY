
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, RefreshControl, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  ChevronLeft, Search, Filter, X, Shield, User, BookOpen,
  Package, ShoppingCart, Banknote, TrendingUp, Settings,
  LogIn, ChevronDown, ChevronRight, AlertTriangle, RefreshCw,
  Calendar, Clock,
} from "lucide-react-native";
import { format } from "date-fns";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/lib/auth";

type AuditRow = {
  id: number;
  action: string;
  entity: string;
  details: string | null;
  createdAt: string;
  userId: number;
  userName: string;
  userRole: string;
  userUsername: string;
};

type Facets = {
  actions: string[];
  entities: string[];
  users: { id: number; name: string; role: string }[];
};

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  create:               { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  update:               { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200" },
  delete:               { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" },
  assign:               { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  return:               { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200" },
  transfer:             { bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200" },
  stock_in:             { bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-200" },
  adjust:               { bg: "bg-slate-50",   text: "text-slate-700",   border: "border-slate-200" },
  sale:                 { bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200" },
  sale_conflict:        { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" },
  remittance:           { bg: "bg-green-50",   text: "text-green-700",   border: "border-green-200" },
  remittance_allocated: { bg: "bg-green-50",   text: "text-green-700",   border: "border-green-200" },
  price_change:         { bg: "bg-yellow-50",  text: "text-yellow-700",  border: "border-yellow-200" },
  activate:             { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  deactivate:           { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" },
  login:                { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200" },
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  book:       <BookOpen size={13} color="#64748b" />,
  user:       <User size={13} color="#64748b" />,
  stock:      <Package size={13} color="#64748b" />,
  sale:       <ShoppingCart size={13} color="#64748b" />,
  remittance: <Banknote size={13} color="#64748b" />,
  auth:       <LogIn size={13} color="#64748b" />,
};

const ROLE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  super_admin:       { bg: "bg-amber-100",   text: "text-amber-800",  label: "Admin" },
  inventory_manager: { bg: "bg-blue-100",    text: "text-blue-800",   label: "Manager" },
  distributor:       { bg: "bg-slate-100",   text: "text-slate-700",  label: "Distributor" },
};

function ActionBadge({ action }: { action: string }) {
  const c = ACTION_COLORS[action] ?? { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
  const label = action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  return (
    <View className={`self-start rounded-full border px-2 py-0.5 ${c.bg} ${c.border}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wide ${c.text}`}>{label}</Text>
    </View>
  );
}

function RoleBadge({ role }: { role: string }) {
  const b = ROLE_BADGE[role] ?? { bg: "bg-slate-100", text: "text-slate-600", label: role };
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${b.bg}`}>
      <Text className={`text-[10px] font-semibold ${b.text}`}>{b.label}</Text>
    </View>
  );
}

function AuditCard({ row }: { row: AuditRow }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(row.createdAt);

  return (
    <Pressable
      onPress={() => setExpanded(v => !v)}
      accessibilityLabel={`Audit entry: ${row.action} on ${row.entity}`}
      className="bg-white rounded-2xl border border-slate-100 mb-2 overflow-hidden active:opacity-90"
      style={{ shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}
    >
      {/* Main row */}
      <View className="flex-row items-start p-md gap-sm">
        {/* Entity icon */}
        <View className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 items-center justify-center mt-xs">
          {ENTITY_ICONS[row.entity] ?? <Settings size={13} color="#64748b" />}
        </View>

        <View className="flex-1">
          {/* Action + entity */}
          <View className="flex-row items-center gap-xs flex-wrap mb-xs">
            <ActionBadge action={row.action} />
            <Text className="text-slate-400 text-[10px] font-medium uppercase tracking-wide">{row.entity}</Text>
          </View>

          {/* Details preview */}
          {row.details ? (
            <Text
              className="text-slate-700 text-sm leading-5"
              numberOfLines={expanded ? undefined : 2}
            >
              {row.details}
            </Text>
          ) : (
            <Text className="text-slate-400 text-sm italic">No details recorded</Text>
          )}

          {/* Actor + timestamp */}
          <View className="flex-row items-center gap-sm mt-sm flex-wrap">
            <View className="flex-row items-center gap-xs">
              <View className="w-5 h-5 rounded-full bg-amber-100 items-center justify-center">
                <Text className="text-amber-700 text-[9px] font-bold">{row.userName[0]}</Text>
              </View>
              <Text className="text-slate-600 text-xs font-semibold">{row.userName}</Text>
              <RoleBadge role={row.userRole} />
            </View>
            <View className="flex-row items-center gap-xs">
              <Clock size={11} color="#94a3b8" />
              <Text className="text-slate-400 text-xs">
                {format(date, "d MMM yyyy, HH:mm")}
              </Text>
            </View>
          </View>
        </View>

        {/* Expand chevron */}
        <View className="mt-xs">
          {expanded
            ? <ChevronDown size={14} color="#94a3b8" />
            : <ChevronRight size={14} color="#94a3b8" />}
        </View>
      </View>

      {/* Expanded: full details + metadata */}
      {expanded && (
        <View className="border-t border-slate-100 bg-slate-50 px-md py-sm">
          <View className="flex-row gap-lg flex-wrap">
            <View>
              <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-xs">Record ID</Text>
              <Text className="text-slate-700 text-xs font-mono">#{row.id}</Text>
            </View>
            <View>
              <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-xs">Actor ID</Text>
              <Text className="text-slate-700 text-xs font-mono">#{row.userId}</Text>
            </View>
            <View>
              <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-xs">Username</Text>
              <Text className="text-slate-700 text-xs font-mono">@{row.userUsername}</Text>
            </View>
            <View>
              <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-xs">Timestamp</Text>
              <Text className="text-slate-700 text-xs font-mono">{date.toISOString()}</Text>
            </View>
          </View>
          {row.details && (
            <View className="mt-sm">
              <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-xs">Full Details</Text>
              <Text className="text-slate-700 text-xs leading-4">{row.details}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

function FilterSheet({
  visible, onClose, facets, filters, onApply,
}: {
  visible: boolean;
  onClose: () => void;
  facets: Facets | null;
  filters: { action: string; entity: string; userId: string };
  onApply: (f: { action: string; entity: string; userId: string }) => void;
}) {
  const [local, setLocal] = useState(filters);

  useEffect(() => { setLocal(filters); }, [filters, visible]);

  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      className={`self-start rounded-full border px-md py-xs mr-sm mb-sm ${active ? "bg-amber-500 border-amber-500" : "bg-white border-slate-200"}`}
    >
      <Text className={`text-xs font-semibold ${active ? "text-white" : "text-slate-600"}`}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()} className="bg-white rounded-t-3xl">
          <View className="items-center pt-md pb-sm">
            <View className="w-10 h-1 rounded-full bg-slate-200" />
          </View>
          <ScrollView className="px-lg" contentContainerClassName="pb-3xl" showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between mb-lg">
              <Text className="text-slate-900 text-xl font-extrabold">Filter Audit Log</Text>
              <Pressable onPress={onClose} className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center">
                <X size={18} color="#475569" />
              </Pressable>
            </View>

            <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-sm">Action</Text>
            <View className="flex-row flex-wrap mb-md">
              <Chip label="All" active={local.action === "all"} onPress={() => setLocal(l => ({ ...l, action: "all" }))} />
              {facets?.actions.map(a => (
                <Chip key={a} label={a.replace(/_/g, " ")} active={local.action === a} onPress={() => setLocal(l => ({ ...l, action: a }))} />
              ))}
            </View>

            <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-sm">Entity</Text>
            <View className="flex-row flex-wrap mb-md">
              <Chip label="All" active={local.entity === "all"} onPress={() => setLocal(l => ({ ...l, entity: "all" }))} />
              {facets?.entities.map(e => (
                <Chip key={e} label={e} active={local.entity === e} onPress={() => setLocal(l => ({ ...l, entity: e }))} />
              ))}
            </View>

            <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-sm">User</Text>
            <View className="flex-row flex-wrap mb-lg">
              <Chip label="All" active={local.userId === "all"} onPress={() => setLocal(l => ({ ...l, userId: "all" }))} />
              {facets?.users.map(u => (
                <Chip key={u.id} label={u.name} active={local.userId === String(u.id)} onPress={() => setLocal(l => ({ ...l, userId: String(u.id) }))} />
              ))}
            </View>

            <View className="flex-row gap-sm">
              <Pressable
                onPress={() => { setLocal({ action: "all", entity: "all", userId: "all" }); }}
                className="flex-1 rounded-2xl border border-slate-200 py-md items-center"
              >
                <Text className="text-slate-600 font-semibold">Reset</Text>
              </Pressable>
              <Pressable
                onPress={() => { onApply(local); onClose(); }}
                className="flex-1 rounded-2xl bg-amber-500 py-md items-center"
              >
                <Text className="text-white font-bold">Apply</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function AuditScreen() {
  const router = useRouter();
  const user = useAuth(s => s.user);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ action: "all", entity: "all", userId: "all" });

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (filters.action !== "all") qs.set("action", filters.action);
      if (filters.entity !== "all") qs.set("entity", filters.entity);
      if (filters.userId !== "all") qs.set("userId", filters.userId);
      qs.set("limit", "500");

      const [data, fData] = await Promise.all([
        authFetch(`/api/audit?${qs.toString()}`),
        facets ? Promise.resolve(facets) : authFetch("/api/audit/facets"),
      ]);
      setRows(data);
      if (!facets) setFacets(fData);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Failed to load audit log");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = rows.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.userName.toLowerCase().includes(q) ||
      r.action.toLowerCase().includes(q) ||
      r.entity.toLowerCase().includes(q) ||
      (r.details ?? "").toLowerCase().includes(q)
    );
  });

  const activeFilterCount = [
    filters.action !== "all",
    filters.entity !== "all",
    filters.userId !== "all",
  ].filter(Boolean).length;

  if (user?.role !== "super_admin") {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50 items-center justify-center px-lg">
        <StatusBar style="dark" />
        <Shield size={40} color="#d97706" />
        <Text className="text-stone-900 font-bold text-lg mt-md">Admin Only</Text>
        <Text className="text-stone-500 text-sm text-center mt-xs">The audit log is restricted to Super Admins.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-slate-50">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="bg-white border-b border-slate-100 px-lg pt-sm pb-md"
        style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
        <View className="flex-row items-center gap-sm mb-md">
          <Pressable onPress={() => router.back()} accessibilityLabel="Back"
            className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:opacity-70">
            <ChevronLeft size={20} color="#334155" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-slate-900 text-xl font-extrabold">Critical Audit Log</Text>
            <Text className="text-slate-500 text-xs mt-xs">
              {loading ? "Loading…" : `${filtered.length} records · append-only`}
            </Text>
          </View>
          <Pressable onPress={onRefresh} accessibilityLabel="Refresh"
            className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:opacity-70">
            <RefreshCw size={16} color="#64748b" />
          </Pressable>
        </View>

        {/* Search + Filter */}
        <View className="flex-row gap-sm">
          <View className="flex-1 flex-row items-center rounded-xl bg-slate-100 px-md gap-sm">
            <Search size={16} color="#94a3b8" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by user, action, details…"
              placeholderTextColor="#94a3b8"
              className="flex-1 py-sm text-slate-800 text-sm"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} accessibilityLabel="Clear search">
                <X size={14} color="#94a3b8" />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => setShowFilter(true)}
            accessibilityLabel="Filter audit log"
            className={`w-11 h-11 rounded-xl items-center justify-center ${activeFilterCount > 0 ? "bg-amber-500" : "bg-slate-100"}`}
          >
            <Filter size={18} color={activeFilterCount > 0 ? "#fff" : "#64748b"} />
            {activeFilterCount > 0 && (
              <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 items-center justify-center">
                <Text className="text-white text-[9px] font-bold">{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-xs pt-sm">
            {filters.action !== "all" && (
              <View className="flex-row items-center gap-xs rounded-full bg-amber-100 border border-amber-200 px-sm py-xs">
                <Text className="text-amber-700 text-xs font-semibold">{filters.action.replace(/_/g, " ")}</Text>
                <Pressable onPress={() => setFilters(f => ({ ...f, action: "all" }))} accessibilityLabel="Remove action filter">
                  <X size={11} color="#d97706" />
                </Pressable>
              </View>
            )}
            {filters.entity !== "all" && (
              <View className="flex-row items-center gap-xs rounded-full bg-amber-100 border border-amber-200 px-sm py-xs">
                <Text className="text-amber-700 text-xs font-semibold">{filters.entity}</Text>
                <Pressable onPress={() => setFilters(f => ({ ...f, entity: "all" }))} accessibilityLabel="Remove entity filter">
                  <X size={11} color="#d97706" />
                </Pressable>
              </View>
            )}
            {filters.userId !== "all" && (
              <View className="flex-row items-center gap-xs rounded-full bg-amber-100 border border-amber-200 px-sm py-xs">
                <Text className="text-amber-700 text-xs font-semibold">
                  {facets?.users.find(u => String(u.id) === filters.userId)?.name ?? `User #${filters.userId}`}
                </Text>
                <Pressable onPress={() => setFilters(f => ({ ...f, userId: "all" }))} accessibilityLabel="Remove user filter">
                  <X size={11} color="#d97706" />
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Legend */}
      <View className="bg-amber-50 border-b border-amber-100 px-lg py-sm flex-row items-center gap-sm">
        <Shield size={13} color="#d97706" />
        <Text className="text-amber-700 text-xs font-medium flex-1">
          Append-only · Every record captures actor name, ID, entity ID, and exact timestamp
        </Text>
      </View>

      {/* Content */}
      {loading ? (
        <ScrollView className="flex-1" contentContainerClassName="px-lg pt-lg gap-sm">
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} className="h-24 rounded-2xl bg-slate-200" />
          ))}
        </ScrollView>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-lg">
          <AlertTriangle size={32} color="#f43f5e" />
          <Text className="text-slate-900 font-bold text-lg mt-md">Failed to load</Text>
          <Text className="text-slate-500 text-sm text-center mt-xs">{error}</Text>
          <Pressable onPress={() => { setLoading(true); load(); }}
            className="mt-lg rounded-2xl bg-amber-500 px-xl py-md active:opacity-80">
            <Text className="text-white font-bold">Retry</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-lg">
          <Shield size={40} color="#94a3b8" />
          <Text className="text-slate-900 font-bold text-lg mt-md">No records found</Text>
          <Text className="text-slate-500 text-sm text-center mt-xs">
            {search ? "Try a different search term." : "No audit entries match the current filters."}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-lg pt-md pb-3xl"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}
        >
          {/* Stats bar */}
          <View className="flex-row gap-sm mb-md">
            {[
              { label: "Total", value: filtered.length, color: "text-slate-900" },
              { label: "Sales", value: filtered.filter(r => r.entity === "sale").length, color: "text-indigo-600" },
              { label: "Stock", value: filtered.filter(r => r.entity === "stock").length, color: "text-amber-600" },
              { label: "Users", value: filtered.filter(r => r.entity === "user").length, color: "text-emerald-600" },
            ].map(s => (
              <View key={s.label} className="flex-1 rounded-xl bg-white border border-slate-100 p-sm items-center"
                style={{ shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
                <Text className={`text-base font-extrabold ${s.color}`}>{s.value}</Text>
                <Text className="text-slate-400 text-[10px] font-medium">{s.label}</Text>
              </View>
            ))}
          </View>

          {filtered.map(row => (
            <AuditCard key={row.id} row={row} />
          ))}
        </ScrollView>
      )}

      <FilterSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        facets={facets}
        filters={filters}
        onApply={setFilters}
      />
    </SafeAreaView>
  );
}

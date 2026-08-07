
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl, Modal,
  TextInput, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  ChevronLeft, TrendingUp, Trophy, BookOpen,
  BarChart3, Percent, WifiOff, Calendar, X, ChevronRight,
  ArrowUpRight, ArrowDownRight, Users, DollarSign, Banknote,
  CreditCard, AlertCircle, ChevronDown, Activity, Target,
} from "lucide-react-native";
import {
  format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, isWithinInterval,
} from "date-fns";
import { useAuth, authFetch } from "@/lib/auth";
import { EmptyState, Chip } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";
import { useIsOnline, startConnectivityPolling } from "@/lib/connectivity";
import Svg, {
  Rect, Text as SvgText, Path, Circle, G, Defs,
  LinearGradient as SvgLinearGradient, Stop, Line,
} from "react-native-svg";

const SCREEN_W = Dimensions.get("window").width;
const CHART_W = SCREEN_W - 48;

const C = {
  amber: "#f59e0b",
  amberDark: "#d97706",
  emerald: "#10b981",
  emeraldDark: "#059669",
  rose: "#f43f5e",
  blue: "#3b82f6",
  blueDark: "#2563eb",
  purple: "#8b5cf6",
  navy: "#0f172a",
  navyMid: "#1e293b",
  navyLight: "#334155",
  slate: "#475569",
  muted: "#94a3b8",
  border: "#e2e8f0",
  bg: "#f8fafc",
  white: "#ffffff",
};

// ─── Sparkline Area Chart ────────────────────────────────────────────────────
function SparkArea({ points, color, width = CHART_W, height = 160 }: {
  points: { value: number }[]; color: string; width?: number; height?: number;
}) {
  if (!points.length) return null;
  const PL = 12, PR = 12, PT = 16, PB = 8;
  const W = width - PL - PR;
  const H = height - PT - PB;
  const max = Math.max(...points.map(p => p.value), 1);
  const min = Math.min(...points.map(p => p.value), 0);
  const range = max - min || 1;
  const xs = points.map((_, i) => PL + (i / Math.max(points.length - 1, 1)) * W);
  const ys = points.map(p => PT + H - ((p.value - min) / range) * H);
  const pathD = points.map((_, i) => `${i === 0 ? "M" : "L"}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${xs[xs.length - 1].toFixed(1)},${(PT + H).toFixed(1)} L${PL.toFixed(1)},${(PT + H).toFixed(1)} Z`;
  const gradId = `g${color.replace("#", "")}`;

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75, 1].map(f => PT + H - f * H);

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </SvgLinearGradient>
      </Defs>
      {gridLines.map((y, i) => (
        <Line key={i} x1={PL} y1={y} x2={PL + W} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4" />
      ))}
      <Path d={areaD} fill={`url(#${gradId})`} />
      <Path d={pathD} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((_, i) => (
        <Circle key={i} cx={xs[i]} cy={ys[i]} r="3.5" fill={color} stroke="#fff" strokeWidth="2" />
      ))}
    </Svg>
  );
}

// ─── Horizontal Bar Chart ────────────────────────────────────────────────────
function HBarChart({ bars, color, width = CHART_W, maxBars = 6 }: {
  bars: { label: string; value: number; sub?: string }[];
  color: string; width?: number; maxBars?: number;
}) {
  const shown = bars.slice(0, maxBars);
  const max = Math.max(...shown.map(b => b.value), 1);
  const barH = 28;
  const gap = 10;
  const labelW = 100;
  const barAreaW = width - labelW - 60;
  const totalH = shown.length * (barH + gap);

  return (
    <Svg width={width} height={totalH + 8}>
      {shown.map((b, i) => {
        const bW = Math.max(4, (b.value / max) * barAreaW);
        const y = i * (barH + gap);
        return (
          <G key={i}>
            <SvgText x={0} y={y + barH / 2 + 4} fontSize="11" fill={C.navy} fontWeight="600" numberOfLines={1}>
              {b.label.length > 12 ? b.label.slice(0, 12) + "…" : b.label}
            </SvgText>
            <Rect x={labelW} y={y + 4} width={bW} height={barH - 8} rx="4" fill={color} opacity="0.85" />
            <SvgText x={labelW + bW + 6} y={y + barH / 2 + 4} fontSize="11" fill={C.slate} fontWeight="700">
              {b.sub ?? ""}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────
function DonutChart({ slices, size = 130 }: {
  slices: { value: number; color: string; label: string }[];
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!total) return null;
  const cx = size / 2, cy = size / 2;
  const r = size * 0.40, innerR = size * 0.26;
  let angle = -Math.PI / 2;
  const paths: { d: string; color: string }[] = [];
  for (const s of slices) {
    const sweep = (s.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep), y2 = cy + r * Math.sin(angle + sweep);
    const ix1 = cx + innerR * Math.cos(angle), iy1 = cy + innerR * Math.sin(angle);
    const ix2 = cx + innerR * Math.cos(angle + sweep), iy2 = cy + innerR * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} L${ix2.toFixed(2)},${iy2.toFixed(2)} A${innerR},${innerR} 0 ${large},0 ${ix1.toFixed(2)},${iy1.toFixed(2)} Z`;
    paths.push({ d, color: s.color });
    angle += sweep;
  }
  return (
    <Svg width={size} height={size}>
      {paths.map((p, i) => (
        <Path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth="2" />
      ))}
    </Svg>
  );
}

// ─── Calendar Picker ─────────────────────────────────────────────────────────
function CalendarPicker({ visible, onClose, onSelect, initialFrom, initialTo }: {
  visible: boolean; onClose: () => void;
  onSelect: (from: Date, to: Date) => void;
  initialFrom?: Date; initialTo?: Date;
}) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selecting, setSelecting] = useState<"from" | "to">("from");
  const [from, setFrom] = useState<Date | null>(initialFrom ?? null);
  const [to, setTo] = useState<Date | null>(initialTo ?? null);

  const daysInView = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 }),
  });

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const handleDay = (day: Date) => {
    if (selecting === "from") {
      setFrom(day); setTo(null); setSelecting("to");
    } else {
      if (from && day < from) { setFrom(day); setTo(null); setSelecting("to"); }
      else { setTo(day); setSelecting("from"); }
    }
  };

  const apply = () => {
    if (from && to) { onSelect(from, to); onClose(); }
    else if (from) { onSelect(from, from); onClose(); }
  };

  const presets = [
    { label: "Today", from: new Date(), to: new Date() },
    { label: "Last 7d", from: subDays(new Date(), 6), to: new Date() },
    { label: "This month", from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    { label: "Last 30d", from: subDays(new Date(), 29), to: new Date() },
    { label: "Last 90d", from: subDays(new Date(), 89), to: new Date() },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()} className="bg-white rounded-t-3xl">
          {/* Handle */}
          <View className="items-center pt-md pb-sm">
            <View className="w-10 h-1 rounded-full bg-slate-200" />
          </View>

          <View className="px-lg pb-lg">
            <View className="flex-row items-center justify-between mb-lg">
              <View>
                <Text className="text-slate-900 text-xl font-extrabold">Date Range</Text>
                <Text className="text-slate-500 text-xs mt-xs">
                  {selecting === "from" ? "Select start date" : "Select end date"}
                </Text>
              </View>
              <Pressable onPress={onClose} accessibilityLabel="Close"
                className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center">
                <X size={18} color="#475569" />
              </Pressable>
            </View>

            {/* Presets */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm mb-lg">
              {presets.map(p => {
                const active = from && to && isSameDay(from, p.from) && isSameDay(to, p.to);
                return (
                  <Pressable key={p.label} onPress={() => { setFrom(p.from); setTo(p.to); }}
                    className={`self-start rounded-full border px-md py-xs ${active ? "bg-amber-500 border-amber-500" : "border-slate-200 bg-slate-50"}`}>
                    <Text className={`text-sm font-semibold ${active ? "text-white" : "text-slate-600"}`}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Month nav */}
            <View className="flex-row items-center justify-between mb-md">
              <Pressable onPress={prevMonth} className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:opacity-60" accessibilityLabel="Previous month">
                <ChevronLeft size={18} color="#334155" />
              </Pressable>
              <Text className="text-slate-900 font-bold text-base">{format(viewDate, "MMMM yyyy")}</Text>
              <Pressable onPress={nextMonth} className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:opacity-60" accessibilityLabel="Next month">
                <ChevronRight size={18} color="#334155" />
              </Pressable>
            </View>

            {/* Day headers */}
            <View className="flex-row mb-sm">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
                <View key={d} className="flex-1 items-center">
                  <Text className="text-slate-400 text-xs font-bold">{d}</Text>
                </View>
              ))}
            </View>

            {/* Days grid */}
            <View className="flex-row flex-wrap mb-lg">
              {daysInView.map((day, i) => {
                const inMonth = isSameMonth(day, viewDate);
                const isFrom = from && isSameDay(day, from);
                const isTo = to && isSameDay(day, to);
                const inRange = from && to && isWithinInterval(day, { start: from, end: to });
                const isSelected = isFrom || isTo;
                return (
                  <Pressable key={i} onPress={() => handleDay(day)}
                    style={{ width: "14.28%", paddingVertical: 3, alignItems: "center" }}
                    accessibilityLabel={format(day, "d MMM yyyy")}>
                    <View className={`w-9 h-9 rounded-full items-center justify-center ${isSelected ? "bg-amber-500" : inRange ? "bg-amber-100" : ""}`}>
                      <Text className={`text-sm font-semibold ${isSelected ? "text-white" : inRange ? "text-amber-700" : inMonth ? "text-slate-800" : "text-slate-300"}`}>
                        {format(day, "d")}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Selected range display */}
            <View className="flex-row items-center gap-sm mb-lg p-md rounded-2xl bg-amber-50 border border-amber-200">
              <Calendar size={16} color={C.amberDark} />
              <Text className="text-slate-700 text-sm flex-1 font-medium">
                {from ? format(from, "d MMM yyyy") : "Start date"} → {to ? format(to, "d MMM yyyy") : "End date"}
              </Text>
            </View>

            <Pressable onPress={apply}
              className={`rounded-2xl py-md items-center ${from ? "bg-amber-500 active:opacity-80" : "bg-slate-100"}`}>
              <Text className={`font-bold text-base ${from ? "text-white" : "text-slate-400"}`}>Apply Range</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, accent, trend }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; accent: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <View className="flex-1 rounded-2xl bg-white border border-slate-100 p-md" style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
      <View className="flex-row items-center justify-between mb-sm">
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: accent + "18", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </View>
        {trend === "up" && <ArrowUpRight size={14} color={C.emerald} />}
        {trend === "down" && <ArrowDownRight size={14} color={C.rose} />}
      </View>
      <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wide" numberOfLines={1}>{label}</Text>
      <Text className="text-slate-900 text-lg font-extrabold mt-xs" numberOfLines={1}>{value}</Text>
      {sub ? <Text className="text-slate-400 text-xs mt-xs" numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ title, sub, icon }: { title: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-sm mb-md">
      {icon && (
        <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center">
          {icon}
        </View>
      )}
      <View className="flex-1">
        <Text className="text-slate-900 text-base font-extrabold">{title}</Text>
        {sub ? <Text className="text-slate-500 text-xs mt-xs">{sub}</Text> : null}
      </View>
    </View>
  );
}

// ─── Range Labels ────────────────────────────────────────────────────────────
const RANGE_LABELS: Record<string, string> = {
  all: "All time", today: "Today", week: "Last 7d", month: "This month",
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function Reports() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const online = useIsOnline();

  const [range, setRange] = useState("month");
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [distributorFilter, setDistributorFilter] = useState<number | "all">("all");
  const [trendMode, setTrendMode] = useState<"value" | "copies">("value");
  const [showCalendar, setShowCalendar] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [margin, setMargin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAllowed = user?.role === "super_admin" || user?.role === "inventory_manager";

  useEffect(() => { startConnectivityPolling(); }, []);
  useEffect(() => { if (hydrated && !isAllowed) router.replace("/(tabs)"); }, [hydrated, isAllowed]);

  useEffect(() => {
    if (!online) return;
    authFetch("/api/reports/categories").then(setCategories).catch(() => {});
    authFetch("/api/users/distributors").then(setDistributors).catch(() => {});
  }, [online]);

  const filterQs = useCallback(() => {
    const p = new URLSearchParams();
    if (customFrom && customTo) {
      p.set("from", format(customFrom, "yyyy-MM-dd"));
      p.set("to", format(customTo, "yyyy-MM-dd"));
    } else {
      p.set("range", range);
    }
    if (categoryFilter !== "all") p.set("category", categoryFilter);
    if (distributorFilter !== "all") p.set("distributorId", String(distributorFilter));
    return p;
  }, [range, categoryFilter, distributorFilter, customFrom, customTo]);

  const load = useCallback(async () => {
    if (!online) { setLoading(false); return; }
    setError("");
    try {
      const base = filterQs().toString();
      const trendQs = new URLSearchParams(filterQs());
      trendQs.set("bucket", bucket);
      const [d, t, m] = await Promise.all([
        authFetch(`/api/reports?${base}`),
        authFetch(`/api/reports/trends?${trendQs.toString()}`),
        authFetch(`/api/reports/margin?${base}`),
      ]);
      setData(d); setTrends(t); setMargin(m);
    } catch (e: any) {
      setError(e?.message || "Failed to load reports");
    }
    setLoading(false);
  }, [filterQs, bucket, online]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!isAllowed) return null;

  const s = data?.summary;
  const inr = (n: number) => `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;
  const inrK = (n: number) => {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${Math.round(n)}`;
  };
  const trendPoints = trends?.points ?? [];
  const maxCatValue = data?.categories?.length ? Math.max(...data.categories.map((c: any) => c.value)) : 0;

  const fmtPeriod = (iso: string) => {
    try {
      const d = new Date(iso);
      if (bucket === "month") return format(d, "MMM");
      if (bucket === "week") return format(d, "d MMM");
      return format(d, "d MMM");
    } catch { return iso; }
  };

  const exportBase = `?${filterQs().toString()}`;

  const paymentSlices = s ? [
    { label: "Cash", value: s.cashTotal, color: C.emerald },
    { label: "Online", value: s.onlineTotal, color: C.blue },
    { label: "Debt", value: s.debtTotal, color: C.rose },
  ].filter(x => x.value > 0) : [];

  const dateRangeLabel = customFrom && customTo
    ? `${format(customFrom, "d MMM")} – ${format(customTo, "d MMM yyyy")}`
    : RANGE_LABELS[range] ?? range;

  const activeFilters = (categoryFilter !== "all" ? 1 : 0) + (distributorFilter !== "all" ? 1 : 0);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-slate-50">
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View className="bg-white border-b border-slate-100 px-lg pt-sm pb-md"
        style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-sm">
            <Pressable onPress={() => router.back()} accessibilityLabel="Back"
              className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:opacity-70">
              <ChevronLeft size={20} color="#334155" />
            </Pressable>
            <View>
              <Text className="text-slate-900 text-xl font-extrabold">Business Analytics</Text>
              <View className="flex-row items-center gap-xs mt-xs">
                <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <Text className="text-slate-500 text-xs font-medium">{dateRangeLabel}</Text>
              </View>
            </View>
          </View>
          {online && <ExportButton path={`/api/reports/export/sales.csv${exportBase}`} label="Export" />}
        </View>

        {/* Range chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm pt-md">
          {Object.keys(RANGE_LABELS).map((r) => (
            <Pressable key={r} onPress={() => { setRange(r); setCustomFrom(null); setCustomTo(null); }}
              className={`self-start rounded-full border px-md py-xs ${range === r && !customFrom ? "border-amber-500 bg-amber-500" : "border-slate-200 bg-slate-50"}`}>
              <Text className={`text-xs font-bold ${range === r && !customFrom ? "text-white" : "text-slate-600"}`}>{RANGE_LABELS[r]}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowCalendar(true)}
            className={`self-start flex-row items-center gap-xs rounded-full border px-md py-xs ${customFrom ? "border-amber-500 bg-amber-500" : "border-slate-200 bg-slate-50"}`}>
            <Calendar size={12} color={customFrom ? "#fff" : "#64748b"} />
            <Text className={`text-xs font-bold ${customFrom ? "text-white" : "text-slate-600"}`}>
              {customFrom ? dateRangeLabel : "Custom"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* ── Offline gate ── */}
      {!online && (
        <View className="mx-lg mt-md rounded-2xl bg-amber-50 border border-amber-200 p-md flex-row items-center gap-sm">
          <WifiOff size={16} color={C.amberDark} />
          <Text className="text-amber-800 font-semibold text-sm flex-1">Reports require a connection</Text>
        </View>
      )}

      <ScrollView className="flex-1" contentContainerClassName="pb-3xl"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.amberDark} />}>

        {!online ? (
          <View className="mx-lg mt-lg rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <EmptyState icon={<WifiOff size={26} color="#94a3b8" />} title="No connection"
              description="Connect to the internet to view analytics." />
          </View>
        ) : error ? (
          <View className="mx-lg mt-lg rounded-2xl bg-rose-50 border border-rose-200 p-lg">
            <View className="flex-row items-center gap-sm mb-sm">
              <AlertCircle size={18} color={C.rose} />
              <Text className="text-rose-700 font-bold">Failed to load analytics</Text>
            </View>
            <Text className="text-rose-600 text-sm">{error}</Text>
            <Pressable onPress={onRefresh} className="mt-md self-start rounded-full bg-rose-600 px-lg py-xs active:opacity-80">
              <Text className="text-white text-sm font-bold">Retry</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View className="px-lg pt-lg gap-md">
            {/* Hero skeleton */}
            <View className="h-44 rounded-3xl bg-slate-200" />
            {/* KPI row */}
            <View className="flex-row gap-sm">
              <View className="flex-1 h-24 rounded-2xl bg-slate-200" />
              <View className="flex-1 h-24 rounded-2xl bg-slate-200" />
              <View className="flex-1 h-24 rounded-2xl bg-slate-200" />
            </View>
            <View className="flex-row gap-sm">
              <View className="flex-1 h-24 rounded-2xl bg-slate-200" />
              <View className="flex-1 h-24 rounded-2xl bg-slate-200" />
            </View>
            {/* Chart skeleton */}
            <View className="h-56 rounded-2xl bg-slate-200" />
            <View className="h-48 rounded-2xl bg-slate-200" />
          </View>
        ) : !data ? (
          <View className="mx-lg mt-lg rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <EmptyState icon={<TrendingUp size={26} color="#94a3b8" />} title="No data yet"
              description="Sales activity will appear here once distributors start logging sales." />
          </View>
        ) : (
          <>
            {/* ── Hero Revenue Card ── */}
            <View className="mx-lg mt-lg rounded-3xl overflow-hidden"
              style={{ backgroundColor: C.navy, shadowColor: C.navy, shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
              <View className="p-xl">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-xs mb-xs">
                      <View className="w-2 h-2 rounded-full bg-amber-400" />
                      <Text style={{ color: "#94a3b8", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" }}>
                        Total Revenue
                      </Text>
                    </View>
                    <Text style={{ color: "#fff", fontSize: 38, fontWeight: "800", lineHeight: 44 }}>
                      {inr(s.totalSalesValue)}
                    </Text>
                    <Text style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{dateRangeLabel}</Text>
                  </View>
                  <View style={{ backgroundColor: "#f59e0b22", borderRadius: 16, padding: 10 }}>
                    <Activity size={22} color={C.amber} />
                  </View>
                </View>

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: "#1e293b", marginVertical: 16 }} />

                {/* Stats row */}
                <View className="flex-row gap-xl">
                  <View>
                    <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Copies Sold</Text>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 2 }}>
                      {s.totalCopies.toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Free Copies</Text>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 2 }}>
                      {(s.freeCopies ?? 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Outstanding</Text>
                    <Text style={{ color: C.rose, fontSize: 20, fontWeight: "800", marginTop: 2 }}>
                      {inrK(s.outstanding)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── KPI Grid ── */}
            <View className="px-lg mt-md gap-sm">
              <View className="flex-row gap-sm">
                <KpiCard
                  label="Cash Collected"
                  value={inrK(s.cashTotal)}
                  sub={`${s.totalCopies > 0 ? ((s.cashTotal / s.totalSalesValue) * 100).toFixed(0) : 0}% of revenue`}
                  icon={<Banknote size={16} color={C.emerald} />}
                  accent={C.emerald}
                  trend="up"
                />
                <KpiCard
                  label="Online Payments"
                  value={inrK(s.onlineTotal)}
                  sub={`${s.totalSalesValue > 0 ? ((s.onlineTotal / s.totalSalesValue) * 100).toFixed(0) : 0}% of revenue`}
                  icon={<CreditCard size={16} color={C.blue} />}
                  accent={C.blue}
                  trend="up"
                />
                <KpiCard
                  label="Debt / Credit"
                  value={inrK(s.debtTotal)}
                  sub="Pending collection"
                  icon={<AlertCircle size={16} color={C.rose} />}
                  accent={C.rose}
                  trend="down"
                />
              </View>
              <View className="flex-row gap-sm">
                <KpiCard
                  label="Remitted"
                  value={inrK(s.remittedTotal)}
                  sub="Total paid back"
                  icon={<ArrowUpRight size={16} color={C.purple} />}
                  accent={C.purple}
                />
                <KpiCard
                  label="Net Outstanding"
                  value={inrK(s.outstanding)}
                  sub="Debt minus remitted"
                  icon={<Target size={16} color={C.amberDark} />}
                  accent={C.amberDark}
                  trend={s.outstanding > 0 ? "down" : "up"}
                />
              </View>
            </View>

            {/* ── Sales Trend Chart ── */}
            <View className="mx-lg mt-md rounded-3xl bg-white border border-slate-100 overflow-hidden"
              style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <View className="px-lg pt-lg pb-sm">
                <SectionHeader
                  title="Sales Trend"
                  sub={`${trendPoints.length} ${bucket === "day" ? "days" : bucket === "week" ? "weeks" : "months"} · ${dateRangeLabel}`}
                  icon={<TrendingUp size={16} color={C.amberDark} />}
                />

                {/* Controls row */}
                <View className="flex-row items-center justify-between mb-md">
                  {/* Value / Copies toggle */}
                  <View className="flex-row bg-slate-100 rounded-full p-xs gap-xs">
                    <Pressable onPress={() => setTrendMode("value")}
                      className={`rounded-full px-md py-xs ${trendMode === "value" ? "bg-white" : ""}`}
                      style={trendMode === "value" ? { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 } : {}}>
                      <Text className={`text-xs font-bold ${trendMode === "value" ? "text-slate-900" : "text-slate-500"}`}>₹ Value</Text>
                    </Pressable>
                    <Pressable onPress={() => setTrendMode("copies")}
                      className={`rounded-full px-md py-xs ${trendMode === "copies" ? "bg-white" : ""}`}
                      style={trendMode === "copies" ? { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 } : {}}>
                      <Text className={`text-xs font-bold ${trendMode === "copies" ? "text-slate-900" : "text-slate-500"}`}>Copies</Text>
                    </Pressable>
                  </View>

                  {/* Bucket selector */}
                  <View className="flex-row gap-xs">
                    {(["day", "week", "month"] as const).map(b => (
                      <Pressable key={b} onPress={() => setBucket(b)}
                        className={`rounded-full border px-sm py-xs ${bucket === b ? "border-slate-800 bg-slate-800" : "border-slate-200"}`}>
                        <Text className={`text-xs font-semibold ${bucket === b ? "text-white" : "text-slate-500"}`}>
                          {b === "day" ? "D" : b === "week" ? "W" : "M"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {trendPoints.length === 0 ? (
                <View className="pb-lg">
                  <EmptyState icon={<TrendingUp size={24} color="#94a3b8" />} title="No trend data"
                    description="Trend appears once sales are logged in this range." />
                </View>
              ) : (
                <>
                  <View className="px-lg pb-sm">
                    <SparkArea
                      points={trendPoints.map((p: any) => ({ value: trendMode === "value" ? p.value : p.copies }))}
                      color={C.amberDark}
                      width={CHART_W}
                      height={160}
                    />
                  </View>
                  {/* X-axis labels */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg pb-lg gap-md">
                    {trendPoints.slice(0, 14).map((p: any, i: number) => (
                      <View key={i} style={{ width: 48 }} className="items-center">
                        <Text className="text-slate-400 text-[10px] font-medium">{fmtPeriod(p.period)}</Text>
                        <Text className="text-slate-800 text-[10px] font-extrabold mt-xs">
                          {trendMode === "value" ? inrK(p.value) : p.copies}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>

            {/* ── Payment Breakdown Donut ── */}
            {paymentSlices.length > 0 && (
              <View className="mx-lg mt-md rounded-3xl bg-white border border-slate-100 p-lg"
                style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
                <SectionHeader
                  title="Payment Breakdown"
                  sub="How revenue was collected"
                  icon={<DollarSign size={16} color={C.blueDark} />}
                />
                <View className="flex-row items-center gap-lg">
                  <View className="items-center">
                    <DonutChart slices={paymentSlices} size={130} />
                    <Text className="text-slate-500 text-xs mt-sm font-medium">Total</Text>
                    <Text className="text-slate-900 text-sm font-extrabold">{inrK(s.totalSalesValue)}</Text>
                  </View>
                  <View className="flex-1 gap-md">
                    {paymentSlices.map((sl, i) => {
                      const pct = s.totalSalesValue > 0 ? ((sl.value / s.totalSalesValue) * 100).toFixed(1) : "0";
                      return (
                        <View key={i}>
                          <View className="flex-row items-center justify-between mb-xs">
                            <View className="flex-row items-center gap-sm">
                              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: sl.color }} />
                              <Text className="text-slate-700 text-sm font-semibold">{sl.label}</Text>
                            </View>
                            <Text className="text-slate-900 text-sm font-extrabold">{inrK(sl.value)}</Text>
                          </View>
                          <View className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <View style={{ height: 6, borderRadius: 3, backgroundColor: sl.color, width: `${pct}%` }} />
                          </View>
                          <Text className="text-slate-400 text-xs mt-xs">{pct}% of revenue</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* ── Category Performance ── */}
            <View className="mx-lg mt-md rounded-3xl bg-white border border-slate-100 overflow-hidden"
              style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <View className="px-lg pt-lg pb-sm">
                <SectionHeader
                  title="Category Performance"
                  sub="Revenue by book category"
                  icon={<BarChart3 size={16} color={C.purple} />}
                />
              </View>

              {data.categories.length === 0 ? (
                <View className="pb-lg">
                  <EmptyState icon={<BarChart3 size={24} color="#94a3b8" />} title="No category data"
                    description="Category totals appear after sales are logged." />
                </View>
              ) : (
                <View className="px-lg pb-lg">
                  <HBarChart
                    bars={data.categories.slice(0, 6).map((c: any) => ({
                      label: c.category,
                      value: c.value,
                      sub: inrK(c.value),
                    }))}
                    color={C.purple}
                    width={CHART_W}
                  />
                  <View className="mt-md gap-xs">
                    {data.categories.map((c: any, i: number) => (
                      <View key={c.category} className="flex-row items-center py-sm border-b border-slate-50">
                        <View className="w-6 h-6 rounded-lg items-center justify-center mr-sm"
                          style={{ backgroundColor: i === 0 ? C.amber + "22" : "#f1f5f9" }}>
                          <Text style={{ fontSize: 10, fontWeight: "800", color: i === 0 ? C.amberDark : "#64748b" }}>{i + 1}</Text>
                        </View>
                        <View className="flex-1 pr-sm">
                          <Text className="text-slate-800 text-sm font-semibold" numberOfLines={1}>{c.category}</Text>
                          <View className="h-1 rounded-full bg-slate-100 mt-xs overflow-hidden">
                            <View style={{
                              height: 4, borderRadius: 2,
                              backgroundColor: i === 0 ? C.amber : C.purple,
                              width: `${maxCatValue > 0 ? Math.max(4, (c.value / maxCatValue) * 100) : 0}%`
                            }} />
                          </View>
                        </View>
                        <View className="items-end">
                          <Text className="text-slate-900 text-sm font-extrabold">{inrK(c.value)}</Text>
                          <Text className="text-slate-400 text-xs">{c.copies} copies</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* ── Distributor Leaderboard ── */}
            <View className="mx-lg mt-md rounded-3xl bg-white border border-slate-100 overflow-hidden"
              style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <View className="px-lg pt-lg pb-sm">
                <SectionHeader
                  title="Distributor Leaderboard"
                  sub="Ranked by revenue generated"
                  icon={<Trophy size={16} color={C.amber} />}
                />
              </View>
              {data.leaderboard.length === 0 ? (
                <View className="pb-lg">
                  <EmptyState icon={<Trophy size={24} color="#94a3b8" />} title="No sales yet"
                    description="Rankings appear once sales are logged." />
                </View>
              ) : (
                <View className="px-lg pb-lg gap-sm">
                  {data.leaderboard.map((l: any, i: number) => {
                    const medals = ["#f59e0b", "#94a3b8", "#f97316"];
                    const isMedal = i < 3;
                    return (
                      <Pressable key={l.distributorId}
                        onPress={() => router.push({ pathname: "/distributor/[id]", params: { id: String(l.distributorId), name: l.name } })}
                        className="flex-row items-center rounded-2xl p-md active:opacity-80"
                        style={{ backgroundColor: i === 0 ? "#fffbeb" : "#f8fafc", borderWidth: 1, borderColor: i === 0 ? "#fde68a" : "#f1f5f9" }}>
                        <View style={{
                          width: 36, height: 36, borderRadius: 12,
                          backgroundColor: isMedal ? medals[i] + "22" : "#f1f5f9",
                          alignItems: "center", justifyContent: "center", marginRight: 12,
                        }}>
                          <Text style={{ fontSize: 13, fontWeight: "800", color: isMedal ? medals[i] : "#94a3b8" }}>
                            {i + 1}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-slate-900 font-bold text-sm">{l.name}</Text>
                          <Text className="text-slate-500 text-xs">{l.copies.toLocaleString("en-IN")} copies sold</Text>
                        </View>
                        <View className="items-end">
                          <Text style={{ color: i === 0 ? C.amberDark : "#334155", fontWeight: "800", fontSize: 14 }}>
                            {inrK(l.value)}
                          </Text>
                          <ChevronRight size={14} color="#94a3b8" />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* ── Top-Selling Titles ── */}
            <View className="mx-lg mt-md rounded-3xl bg-white border border-slate-100 overflow-hidden"
              style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <View className="px-lg pt-lg pb-sm">
                <SectionHeader
                  title="Top-Selling Titles"
                  sub="Best performers by copies sold"
                  icon={<BookOpen size={16} color={C.slate} />}
                />
              </View>
              {data.topBooks.length === 0 ? (
                <View className="pb-lg">
                  <EmptyState icon={<BookOpen size={24} color="#94a3b8" />} title="No titles sold"
                    description="Best sellers appear once sales are logged." />
                </View>
              ) : (
                <View className="px-lg pb-lg gap-sm">
                  {data.topBooks.map((b: any, i: number) => (
                    <View key={b.sku} className="flex-row items-center rounded-2xl bg-slate-50 border border-slate-100 p-md">
                      <View className="w-8 h-8 rounded-xl items-center justify-center mr-sm"
                        style={{ backgroundColor: i === 0 ? C.amber + "22" : "#f1f5f9" }}>
                        <Text style={{ fontSize: 11, fontWeight: "800", color: i === 0 ? C.amberDark : "#94a3b8" }}>{i + 1}</Text>
                      </View>
                      <View className="flex-1 pr-sm">
                        <Text className="text-slate-900 font-semibold text-sm" numberOfLines={1}>{b.title}</Text>
                        <Text className="text-slate-400 text-xs">{b.sku}</Text>
                      </View>
                      <View className="items-end">
                        <Text style={{ color: C.amberDark, fontWeight: "800", fontSize: 15 }}>{b.copies}</Text>
                        <Text className="text-slate-400 text-xs">copies</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── Profit Margin Hero ── */}
            {margin && (
              <>
                <View className="mx-lg mt-md rounded-3xl overflow-hidden"
                  style={{ backgroundColor: "#064e3b", shadowColor: "#064e3b", shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
                  <View className="p-xl">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-xs mb-xs">
                          <View className="w-2 h-2 rounded-full bg-emerald-400" />
                          <Text style={{ color: "#6ee7b7", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" }}>
                            Net Profit Margin
                          </Text>
                        </View>
                        <Text style={{ color: "#fff", fontSize: 38, fontWeight: "800", lineHeight: 44 }}>
                          {inr(margin.overall.margin)}
                        </Text>
                        <View className="flex-row items-center gap-xs mt-xs">
                          <View className="rounded-full px-sm py-xs" style={{ backgroundColor: "#10b98133" }}>
                            <Text style={{ color: "#6ee7b7", fontSize: 12, fontWeight: "700" }}>
                              {margin.overall.marginPct.toFixed(1)}% margin
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={{ backgroundColor: "#10b98122", borderRadius: 16, padding: 10 }}>
                        <Percent size={22} color={C.emerald} />
                      </View>
                    </View>

                    <View style={{ height: 1, backgroundColor: "#065f46", marginVertical: 16 }} />

                    <View className="flex-row gap-xl">
                      <View>
                        <Text style={{ color: "#6ee7b7", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Revenue</Text>
                        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 2 }}>{inrK(margin.overall.revenue)}</Text>
                      </View>
                      <View>
                        <Text style={{ color: "#6ee7b7", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Cost</Text>
                        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 2 }}>{inrK(margin.overall.cost)}</Text>
                      </View>
                      <View>
                        <Text style={{ color: "#6ee7b7", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Copies</Text>
                        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 2 }}>{margin.overall.copies.toLocaleString("en-IN")}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Margin by Category */}
                {margin.byCategory.length > 0 && (
                  <View className="mx-lg mt-md rounded-3xl bg-white border border-slate-100 overflow-hidden"
                    style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
                    <View className="px-lg pt-lg pb-sm">
                      <SectionHeader
                        title="Margin by Category"
                        sub="Profitability per category"
                        icon={<Percent size={16} color={C.emeraldDark} />}
                      />
                    </View>
                    <View className="px-lg pb-lg gap-sm">
                      {margin.byCategory.map((c: any) => {
                        const isPos = c.margin >= 0;
                        return (
                          <View key={c.category} className="rounded-2xl p-md"
                            style={{ backgroundColor: isPos ? "#f0fdf4" : "#fff1f2", borderWidth: 1, borderColor: isPos ? "#bbf7d0" : "#fecdd3" }}>
                            <View className="flex-row justify-between items-center">
                              <Text className="text-slate-900 font-bold flex-1 pr-sm text-sm" numberOfLines={1}>{c.category}</Text>
                              <Text style={{ fontWeight: "800", fontSize: 14, color: isPos ? C.emeraldDark : C.rose }}>{inrK(c.margin)}</Text>
                            </View>
                            <View className="flex-row gap-md mt-xs">
                              <Text className="text-slate-500 text-xs">Rev {inrK(c.revenue)}</Text>
                              <Text className="text-slate-500 text-xs">Cost {inrK(c.cost)}</Text>
                              <Text style={{ fontSize: 11, fontWeight: "700", color: isPos ? C.emeraldDark : C.rose }}>{c.marginPct.toFixed(1)}%</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Margin by Distributor */}
                {margin.byDistributor.length > 0 && (
                  <View className="mx-lg mt-md rounded-3xl bg-white border border-slate-100 overflow-hidden"
                    style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
                    <View className="px-lg pt-lg pb-sm">
                      <SectionHeader
                        title="Margin by Distributor"
                        sub="Profitability per distributor"
                        icon={<Users size={16} color={C.blueDark} />}
                      />
                    </View>
                    <View className="px-lg pb-lg gap-sm">
                      {margin.byDistributor.map((d: any) => {
                        const isPos = d.margin >= 0;
                        return (
                          <View key={d.distributorId} className="flex-row items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 p-md">
                            <View className="flex-row items-center gap-sm flex-1">
                              <View className="w-9 h-9 rounded-full bg-blue-100 items-center justify-center">
                                <Text style={{ color: C.blueDark, fontWeight: "800", fontSize: 13 }}>{d.name[0]}</Text>
                              </View>
                              <Text className="text-slate-900 font-semibold flex-1 pr-sm text-sm" numberOfLines={1}>{d.name}</Text>
                            </View>
                            <View className="items-end">
                              <Text style={{ fontWeight: "800", fontSize: 14, color: isPos ? C.emeraldDark : C.rose }}>{inrK(d.margin)}</Text>
                              <Text className="text-slate-400 text-xs">{d.marginPct.toFixed(1)}% margin</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ── Exports ── */}
            <View className="mx-lg mt-md rounded-3xl bg-white border border-slate-100 p-lg"
              style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <Text className="text-slate-900 font-extrabold text-base mb-md">Export Reports</Text>
              <View className="gap-sm">
                <View className="flex-row items-center justify-between p-md rounded-2xl bg-slate-50 border border-slate-100">
                  <View>
                    <Text className="text-slate-900 font-semibold text-sm">Sales Report</Text>
                    <Text className="text-slate-500 text-xs mt-xs">Filtered sales with all details</Text>
                  </View>
                  <ExportButton path={`/api/reports/export/sales.csv${exportBase}`} label="CSV" />
                </View>
                <View className="flex-row items-center justify-between p-md rounded-2xl bg-slate-50 border border-slate-100">
                  <View>
                    <Text className="text-slate-900 font-semibold text-sm">Profit Margin</Text>
                    <Text className="text-slate-500 text-xs mt-xs">Per-book margin analysis</Text>
                  </View>
                  <ExportButton path={`/api/reports/export/margin.csv${exportBase}`} label="CSV" />
                </View>
                <View className="flex-row items-center justify-between p-md rounded-2xl bg-slate-50 border border-slate-100">
                  <View>
                    <Text className="text-slate-900 font-semibold text-sm">Remittances</Text>
                    <Text className="text-slate-500 text-xs mt-xs">Full remittance history</Text>
                  </View>
                  <ExportButton path={`/api/reports/export/remittances.csv${distributorFilter !== "all" ? `?distributorId=${distributorFilter}` : ""}`} label="CSV" />
                </View>
              </View>
            </View>

            {/* ── Filters ── */}
            <View className="mx-lg mt-md rounded-3xl bg-white border border-slate-100 overflow-hidden"
              style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <Pressable onPress={() => setShowFilters(f => !f)}
                className="flex-row items-center justify-between px-lg py-md active:opacity-70">
                <View className="flex-row items-center gap-sm">
                  <Text className="text-slate-900 font-extrabold text-base">Filter Reports</Text>
                  {activeFilters > 0 && (
                    <View className="w-5 h-5 rounded-full bg-amber-500 items-center justify-center">
                      <Text className="text-white text-xs font-bold">{activeFilters}</Text>
                    </View>
                  )}
                </View>
                <ChevronDown size={18} color="#64748b" style={{ transform: [{ rotate: showFilters ? "180deg" : "0deg" }] }} />
              </Pressable>

              {showFilters && (
                <View className="px-lg pb-lg">
                  <View className="h-px bg-slate-100 mb-md" />
                  <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-sm">Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm mb-lg">
                    <Chip label="All" active={categoryFilter === "all"} onPress={() => setCategoryFilter("all")} />
                    {categories.map((c) => (
                      <Chip key={c} label={c} active={categoryFilter === c} onPress={() => setCategoryFilter(c)} />
                    ))}
                  </ScrollView>

                  <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-sm">Distributor</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm">
                    <Chip label="All" active={distributorFilter === "all"} onPress={() => setDistributorFilter("all")} />
                    {distributors.map((d) => (
                      <Chip key={d.id} label={d.name} active={distributorFilter === d.id} onPress={() => setDistributorFilter(d.id)} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <CalendarPicker
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelect={(from, to) => { setCustomFrom(from); setCustomTo(to); setRange(""); }}
        initialFrom={customFrom ?? undefined}
        initialTo={customTo ?? undefined}
      />
    </SafeAreaView>
  );
}

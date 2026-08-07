
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl, Modal,
  TextInput, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  ChevronLeft, TrendingUp, Trophy, PieChart as PieIcon, BookOpen,
  BarChart3, Percent, WifiOff, Calendar, X, ChevronDown, ChevronRight,
  ArrowUpRight, ArrowDownRight, Users, DollarSign,
} from "lucide-react-native";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, isWithinInterval, parseISO } from "date-fns";
import { useAuth, authFetch } from "@/lib/auth";
import { Skeleton, EmptyState, Chip, StatCard } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";
import { useIsOnline, startConnectivityPolling } from "@/lib/connectivity";

// ─── Recharts (react-native-svg-based) ────────────────────────────────────────
// We use a pure React Native SVG-based chart approach since Recharts is web-only.
// Charts are built with react-native-svg primitives for full native compatibility.
import Svg, { Rect, Text as SvgText, Line, Path, Circle, G, Defs, LinearGradient, Stop } from "react-native-svg";

const SCREEN_W = Dimensions.get("window").width;
const CHART_W = SCREEN_W - 32;
const CHART_H = 180;
const CHART_COLORS = {
  amber: "#d97706",
  emerald: "#059669",
  rose: "#e11d48",
  blue: "#2563eb",
  purple: "#7c3aed",
};
const CHART_COLOR_LIST = [CHART_COLORS.amber, CHART_COLORS.emerald, CHART_COLORS.blue, CHART_COLORS.purple, CHART_COLORS.rose];

// ─── Mini Area Chart ──────────────────────────────────────────────────────────
function AreaChart({ points, color = CHART_COLORS.amber, height = CHART_H, width = CHART_W }: {
  points: { value: number }[]; color?: string; height?: number; width?: number;
}) {
  if (!points.length) return null;
  const PAD_L = 8, PAD_R = 8, PAD_T = 12, PAD_B = 8;
  const W = width - PAD_L - PAD_R;
  const H = height - PAD_T - PAD_B;
  const max = Math.max(...points.map(p => p.value), 1);
  const xs = points.map((_, i) => PAD_L + (i / Math.max(points.length - 1, 1)) * W);
  const ys = points.map(p => PAD_T + H - (p.value / max) * H);
  const pathD = points.map((_, i) => `${i === 0 ? "M" : "L"}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${xs[xs.length - 1].toFixed(1)},${(PAD_T + H).toFixed(1)} L${PAD_L.toFixed(1)},${(PAD_T + H).toFixed(1)} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      <Path d={areaD} fill={`url(#grad-${color.replace("#", "")})`} />
      <Path d={pathD} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <Circle key={i} cx={xs[i]} cy={ys[i]} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />
      ))}
    </Svg>
  );
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
function BarChart({ bars, color = CHART_COLORS.amber, height = 120, width = CHART_W }: {
  bars: { label: string; value: number }[]; color?: string; height?: number; width?: number;
}) {
  if (!bars.length) return null;
  const PAD_L = 4, PAD_R = 4, PAD_T = 8, PAD_B = 24;
  const W = width - PAD_L - PAD_R;
  const H = height - PAD_T - PAD_B;
  const max = Math.max(...bars.map(b => b.value), 1);
  const barW = Math.max(8, W / bars.length - 4);
  return (
    <Svg width={width} height={height}>
      {bars.map((b, i) => {
        const bH = Math.max(4, (b.value / max) * H);
        const x = PAD_L + (i / bars.length) * W + (W / bars.length - barW) / 2;
        const y = PAD_T + H - bH;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={bH} rx="3" fill={color} opacity="0.85" />
            <SvgText x={x + barW / 2} y={height - 6} fontSize="9" fill="#78716c" textAnchor="middle" numberOfLines={1}>
              {b.label.length > 5 ? b.label.slice(0, 5) : b.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ slices, size = 120 }: { slices: { value: number; color: string }[]; size?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!total) return null;
  const cx = size / 2, cy = size / 2, r = size * 0.38, innerR = size * 0.22;
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
      {paths.map((p, i) => <Path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth="1.5" />)}
    </Svg>
  );
}

// ─── Calendar Date Picker ─────────────────────────────────────────────────────
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
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()} className="bg-white rounded-t-3xl p-lg">
          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-stone-900 text-lg font-extrabold">Select Date Range</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close calendar">
              <X size={22} color="#78716c" />
            </Pressable>
          </View>

          {/* Presets */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm mb-md">
            {presets.map(p => (
              <Pressable key={p.label} onPress={() => { setFrom(p.from); setTo(p.to); }}
                className={`self-start rounded-full border px-md py-xs ${from && to && isSameDay(from, p.from) && isSameDay(to, p.to) ? "bg-amber-600 border-amber-600" : "border-stone-300"}`}>
                <Text className={`text-sm font-medium ${from && to && isSameDay(from, p.from) && isSameDay(to, p.to) ? "text-white" : "text-stone-600"}`}>{p.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Month nav */}
          <View className="flex-row items-center justify-between mb-sm">
            <Pressable onPress={prevMonth} className="p-sm active:opacity-60" accessibilityLabel="Previous month">
              <ChevronLeft size={20} color="#292524" />
            </Pressable>
            <Text className="text-stone-900 font-bold text-base">{format(viewDate, "MMMM yyyy")}</Text>
            <Pressable onPress={nextMonth} className="p-sm active:opacity-60" accessibilityLabel="Next month">
              <ChevronRight size={20} color="#292524" />
            </Pressable>
          </View>

          {/* Day headers */}
          <View className="flex-row mb-xs">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
              <View key={d} className="flex-1 items-center">
                <Text className="text-stone-400 text-xs font-semibold">{d}</Text>
              </View>
            ))}
          </View>

          {/* Days grid */}
          <View className="flex-row flex-wrap">
            {daysInView.map((day, i) => {
              const inMonth = isSameMonth(day, viewDate);
              const isFrom = from && isSameDay(day, from);
              const isTo = to && isSameDay(day, to);
              const inRange = from && to && isWithinInterval(day, { start: from, end: to });
              const isSelected = isFrom || isTo;
              return (
                <Pressable key={i} onPress={() => handleDay(day)}
                  style={{ width: "14.28%", paddingVertical: 4, alignItems: "center" }}
                  accessibilityLabel={format(day, "d MMM yyyy")}>
                  <View className={`w-8 h-8 rounded-full items-center justify-center ${isSelected ? "bg-amber-600" : inRange ? "bg-amber-100" : ""}`}>
                    <Text className={`text-sm font-medium ${isSelected ? "text-white" : inRange ? "text-amber-800" : inMonth ? "text-stone-800" : "text-stone-300"}`}>
                      {format(day, "d")}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Selected range display */}
          <View className="flex-row items-center gap-sm mt-md mb-md p-md rounded-xl bg-stone-50 border border-stone-200">
            <Calendar size={16} color="#d97706" />
            <Text className="text-stone-700 text-sm flex-1">
              {from ? format(from, "d MMM yyyy") : "Start date"} → {to ? format(to, "d MMM yyyy") : "End date"}
            </Text>
          </View>

          <Pressable onPress={apply}
            className={`rounded-xl py-md items-center ${from ? "bg-amber-600 active:opacity-80" : "bg-stone-200"}`}>
            <Text className={`font-bold text-base ${from ? "text-white" : "text-stone-400"}`}>Apply Range</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Reports Screen ──────────────────────────────────────────────────────
const RANGE_LABELS: Record<string, string> = {
  all: "All time", today: "Today", week: "Last 7d", month: "This month",
};

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

  // Payment breakdown for donut
  const paymentSlices = s ? [
    { label: "Cash", value: s.cashTotal, color: CHART_COLORS.emerald },
    { label: "Online", value: s.onlineTotal, color: CHART_COLORS.blue },
    { label: "Debt", value: s.debtTotal, color: CHART_COLORS.rose },
  ].filter(x => x.value > 0) : [];

  const dateRangeLabel = customFrom && customTo
    ? `${format(customFrom, "d MMM")} – ${format(customTo, "d MMM yyyy")}`
    : RANGE_LABELS[range] ?? range;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-lg pt-md pb-sm bg-white border-b border-stone-100">
        <View className="flex-row items-center gap-sm">
          <Pressable onPress={() => router.back()} accessibilityLabel="Back"
            className="w-9 h-9 rounded-full bg-stone-100 items-center justify-center active:opacity-70">
            <ChevronLeft size={20} color="#292524" />
          </Pressable>
          <View>
            <Text className="text-stone-900 text-xl font-extrabold">Analytics</Text>
            <Text className="text-stone-500 text-xs">{dateRangeLabel}</Text>
          </View>
        </View>
        {online && <ExportButton path={`/api/reports/export/sales.csv${exportBase}`} label="Export" />}
      </View>

      {/* Offline gate */}
      {!online && (
        <View className="mx-lg mt-md rounded-xl bg-amber-50 border border-amber-300 p-md">
          <View className="flex-row items-center gap-sm">
            <WifiOff size={16} color="#d97706" />
            <Text className="text-amber-800 font-semibold text-sm flex-1">Reports require a connection</Text>
          </View>
        </View>
      )}

      {online && (
        <>
          {/* Date range controls */}
          <View className="bg-white border-b border-stone-100 pt-sm pb-sm">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg gap-sm">
              {Object.keys(RANGE_LABELS).map((r) => (
                <Pressable key={r} onPress={() => { setRange(r); setCustomFrom(null); setCustomTo(null); }}
                  className={`self-start rounded-full border px-md py-xs ${range === r && !customFrom ? "border-amber-600 bg-amber-600" : "border-stone-300 bg-transparent"}`}>
                  <Text className={`text-sm font-semibold ${range === r && !customFrom ? "text-white" : "text-stone-600"}`}>{RANGE_LABELS[r]}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setShowCalendar(true)}
                className={`self-start flex-row items-center gap-xs rounded-full border px-md py-xs ${customFrom ? "border-amber-600 bg-amber-600" : "border-stone-300 bg-transparent"}`}>
                <Calendar size={13} color={customFrom ? "#fff" : "#78716c"} />
                <Text className={`text-sm font-semibold ${customFrom ? "text-white" : "text-stone-600"}`}>
                  {customFrom ? dateRangeLabel : "Custom"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </>
      )}

      <ScrollView className="flex-1" contentContainerClassName="pb-3xl"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}>

        {!online ? (
          <View className="mx-lg mt-lg rounded-xl bg-white border border-stone-200">
            <EmptyState icon={<WifiOff size={26} color="#a8a29e" />} title="No connection"
              description="Connect to the internet to view reports and analytics." />
          </View>
        ) : error ? (
          <View className="mx-lg mt-lg rounded-xl bg-rose-50 border border-rose-200 p-md">
            <Text className="text-rose-700 font-semibold text-sm">Failed to load reports</Text>
            <Text className="text-rose-600 text-xs mt-xs">{error}</Text>
            <Pressable onPress={onRefresh} className="mt-sm self-start rounded-full bg-rose-600 px-md py-xs active:opacity-80">
              <Text className="text-white text-xs font-semibold">Retry</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View className="px-lg pt-lg gap-md">
            <View className="h-36 rounded-2xl bg-stone-200" />
            <View className="flex-row gap-sm">
              <View className="flex-1 h-20 rounded-xl bg-stone-200" />
              <View className="flex-1 h-20 rounded-xl bg-stone-200" />
              <View className="flex-1 h-20 rounded-xl bg-stone-200" />
            </View>
            <View className="h-52 rounded-xl bg-stone-200" />
            <View className="h-40 rounded-xl bg-stone-200" />
          </View>
        ) : !data ? (
          <View className="mx-lg mt-lg rounded-xl bg-white border border-stone-200">
            <EmptyState icon={<TrendingUp size={26} color="#a8a29e" />} title="No report data"
              description="Sales activity will appear here once distributors start logging sales." />
          </View>
        ) : (
          <>
            {/* ── Hero KPI Card ── */}
            <View className="mx-lg mt-lg rounded-2xl bg-amber-600 overflow-hidden">
              <View className="p-xl">
                <View className="flex-row items-center justify-between mb-xs">
                  <Text className="text-amber-100 text-xs tracking-widest font-semibold uppercase">Total Revenue</Text>
                  <View className="flex-row items-center gap-xs bg-amber-500/50 rounded-full px-sm py-xs">
                    <ArrowUpRight size={12} color="#fff" />
                    <Text className="text-white text-xs font-bold">{dateRangeLabel}</Text>
                  </View>
                </View>
                <Text className="text-white text-4xl font-extrabold mt-xs">{inr(s.totalSalesValue)}</Text>
                <View className="flex-row mt-lg pt-md border-t border-amber-400/40 gap-xl">
                  <View>
                    <Text className="text-amber-200 text-xs font-medium">COPIES SOLD</Text>
                    <Text className="text-white font-extrabold text-lg">{s.totalCopies.toLocaleString("en-IN")}</Text>
                  </View>
                  <View>
                    <Text className="text-amber-200 text-xs font-medium">FREE COPIES</Text>
                    <Text className="text-white font-extrabold text-lg">{(s.freeCopies ?? 0).toLocaleString("en-IN")}</Text>
                  </View>
                  <View>
                    <Text className="text-amber-200 text-xs font-medium">OUTSTANDING</Text>
                    <Text className="text-white font-extrabold text-lg">{inr(s.outstanding)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── KPI Row ── */}
            <View className="flex-row px-lg mt-sm gap-sm">
              <View className="flex-1 rounded-xl bg-white border border-stone-200 p-md">
                <View className="flex-row items-center gap-xs mb-xs">
                  <View className="w-6 h-6 rounded-full bg-emerald-100 items-center justify-center">
                    <DollarSign size={12} color="#059669" />
                  </View>
                  <Text className="text-stone-500 text-xs font-medium">Cash</Text>
                </View>
                <Text className="text-emerald-700 text-base font-extrabold">{inr(s.cashTotal)}</Text>
              </View>
              <View className="flex-1 rounded-xl bg-white border border-stone-200 p-md">
                <View className="flex-row items-center gap-xs mb-xs">
                  <View className="w-6 h-6 rounded-full bg-blue-100 items-center justify-center">
                    <ArrowUpRight size={12} color="#2563eb" />
                  </View>
                  <Text className="text-stone-500 text-xs font-medium">Online</Text>
                </View>
                <Text className="text-blue-700 text-base font-extrabold">{inr(s.onlineTotal)}</Text>
              </View>
              <View className="flex-1 rounded-xl bg-white border border-stone-200 p-md">
                <View className="flex-row items-center gap-xs mb-xs">
                  <View className="w-6 h-6 rounded-full bg-rose-100 items-center justify-center">
                    <ArrowDownRight size={12} color="#e11d48" />
                  </View>
                  <Text className="text-stone-500 text-xs font-medium">Debt</Text>
                </View>
                <Text className="text-rose-600 text-base font-extrabold">{inr(s.debtTotal)}</Text>
              </View>
            </View>

            {/* ── Sales Trend Chart ── */}
            <View className="mx-lg mt-lg rounded-2xl bg-white border border-stone-200 overflow-hidden">
              <View className="px-lg pt-lg pb-sm">
                <View className="flex-row items-center justify-between mb-sm">
                  <View>
                    <Text className="text-stone-900 text-base font-extrabold">Sales Trend</Text>
                    <Text className="text-stone-500 text-xs mt-xs">
                      {trendPoints.length} {bucket === "day" ? "days" : bucket === "week" ? "weeks" : "months"}
                    </Text>
                  </View>
                  <View className="flex-row gap-xs">
                    <Pressable onPress={() => setTrendMode("value")}
                      className={`rounded-full px-sm py-[3px] ${trendMode === "value" ? "bg-amber-600" : "bg-stone-100"}`}>
                      <Text className={`text-xs font-semibold ${trendMode === "value" ? "text-white" : "text-stone-500"}`}>₹ Value</Text>
                    </Pressable>
                    <Pressable onPress={() => setTrendMode("copies")}
                      className={`rounded-full px-sm py-[3px] ${trendMode === "copies" ? "bg-amber-600" : "bg-stone-100"}`}>
                      <Text className={`text-xs font-semibold ${trendMode === "copies" ? "text-white" : "text-stone-500"}`}>Copies</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Bucket selector */}
                <View className="flex-row gap-xs mb-md">
                  {(["day", "week", "month"] as const).map(b => (
                    <Pressable key={b} onPress={() => setBucket(b)}
                      className={`rounded-full border px-sm py-[2px] ${bucket === b ? "border-stone-800 bg-stone-800" : "border-stone-200"}`}>
                      <Text className={`text-xs font-medium ${bucket === b ? "text-white" : "text-stone-500"}`}>
                        {b === "day" ? "Daily" : b === "week" ? "Weekly" : "Monthly"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {trendPoints.length === 0 ? (
                <View className="pb-lg">
                  <EmptyState icon={<TrendingUp size={24} color="#a8a29e" />} title="No trend data"
                    description="Trend appears once sales are logged in this range." />
                </View>
              ) : (
                <>
                  <View className="px-lg pb-xs">
                    <AreaChart
                      points={trendPoints.map((p: any) => ({ value: trendMode === "value" ? p.value : p.copies }))}
                      color={CHART_COLORS.amber}
                      width={CHART_W - 32}
                      height={CHART_H}
                    />
                  </View>
                  {/* X-axis labels */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg pb-md gap-md">
                    {trendPoints.slice(0, 12).map((p: any, i: number) => (
                      <View key={i} style={{ width: 46 }} className="items-center">
                        <Text className="text-stone-500 text-[10px]" numberOfLines={1}>{fmtPeriod(p.period)}</Text>
                        <Text className="text-stone-800 text-[10px] font-bold" numberOfLines={1}>
                          {trendMode === "value" ? `₹${Math.round(p.value / 1000)}k` : p.copies}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>

            {/* ── Payment Breakdown Donut ── */}
            {paymentSlices.length > 0 && (
              <View className="mx-lg mt-md rounded-2xl bg-white border border-stone-200 p-lg">
                <Text className="text-stone-900 text-base font-extrabold mb-md">Payment Breakdown</Text>
                <View className="flex-row items-center gap-xl">
                  <DonutChart slices={paymentSlices} size={110} />
                  <View className="flex-1 gap-sm">
                    {paymentSlices.map((s, i) => (
                      <View key={i} className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-sm">
                          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
                          <Text className="text-stone-700 text-sm font-medium">{s.label}</Text>
                        </View>
                        <Text className="text-stone-900 text-sm font-bold">{inr(s.value)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* ── Category Bar Chart ── */}
            <View className="mx-lg mt-md rounded-2xl bg-white border border-stone-200 overflow-hidden">
              <View className="px-lg pt-lg pb-sm flex-row items-center justify-between">
                <View className="flex-row items-center gap-sm">
                  <View className="w-8 h-8 rounded-full bg-amber-100 items-center justify-center">
                    <BarChart3 size={16} color="#d97706" />
                  </View>
                  <Text className="text-stone-900 text-base font-extrabold">Sales by Category</Text>
                </View>
              </View>

              {data.categories.length === 0 ? (
                <View className="pb-lg">
                  <EmptyState icon={<PieIcon size={24} color="#a8a29e" />} title="No category data"
                    description="Category totals appear after sales are logged." />
                </View>
              ) : (
                <>
                  <View className="px-lg pb-sm">
                    <BarChart
                      bars={data.categories.slice(0, 8).map((c: any) => ({ label: c.category, value: c.value }))}
                      color={CHART_COLORS.amber}
                      width={CHART_W - 32}
                      height={130}
                    />
                  </View>
                  <View className="px-lg pb-lg gap-xs">
                    {data.categories.map((c: any) => (
                      <View key={c.category} className="flex-row items-center justify-between py-xs border-b border-stone-50">
                        <View className="flex-1 pr-sm">
                          <Text className="text-stone-800 text-sm font-semibold" numberOfLines={1}>{c.category}</Text>
                          <View className="h-1.5 rounded-full bg-stone-100 mt-xs overflow-hidden">
                            <View className="h-1.5 rounded-full bg-amber-500"
                              style={{ width: `${maxCatValue > 0 ? Math.max(6, (c.value / maxCatValue) * 100) : 0}%` }} />
                          </View>
                        </View>
                        <View className="items-end">
                          <Text className="text-stone-900 text-sm font-bold">{inr(c.value)}</Text>
                          <Text className="text-stone-400 text-xs">{c.copies} copies</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* ── Distributor Leaderboard ── */}
            <View className="mx-lg mt-md rounded-2xl bg-white border border-stone-200 overflow-hidden">
              <View className="px-lg pt-lg pb-md flex-row items-center gap-sm">
                <View className="w-8 h-8 rounded-full bg-amber-100 items-center justify-center">
                  <Trophy size={16} color="#d97706" />
                </View>
                <Text className="text-stone-900 text-base font-extrabold">Distributor Leaderboard</Text>
              </View>
              {data.leaderboard.length === 0 ? (
                <View className="pb-lg">
                  <EmptyState icon={<Trophy size={24} color="#a8a29e" />} title="No sales yet"
                    description="Rankings appear once sales are logged." />
                </View>
              ) : (
                <View className="px-lg pb-lg gap-sm">
                  {data.leaderboard.map((l: any, i: number) => (
                    <Pressable key={l.distributorId}
                      onPress={() => router.push({ pathname: "/distributor/[id]", params: { id: String(l.distributorId), name: l.name } })}
                      className="flex-row items-center rounded-xl bg-stone-50 border border-stone-100 p-md active:opacity-80">
                      <View className={`w-8 h-8 rounded-full items-center justify-center mr-sm ${i === 0 ? "bg-amber-400" : i === 1 ? "bg-stone-300" : i === 2 ? "bg-orange-300" : "bg-stone-100"}`}>
                        <Text className={`text-sm font-extrabold ${i < 3 ? "text-white" : "text-stone-500"}`}>
                          {i === 0 ? "1" : i === 1 ? "2" : i === 2 ? "3" : `${i + 1}`}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-stone-900 font-semibold text-sm">{l.name}</Text>
                        <Text className="text-stone-500 text-xs">{l.copies.toLocaleString("en-IN")} copies</Text>
                      </View>
                      <Text className="text-amber-700 font-extrabold text-sm">{inr(l.value)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* ── Top-Selling Titles ── */}
            <View className="mx-lg mt-md rounded-2xl bg-white border border-stone-200 overflow-hidden">
              <View className="px-lg pt-lg pb-md flex-row items-center gap-sm">
                <View className="w-8 h-8 rounded-full bg-stone-100 items-center justify-center">
                  <BookOpen size={16} color="#292524" />
                </View>
                <Text className="text-stone-900 text-base font-extrabold">Top-Selling Titles</Text>
              </View>
              {data.topBooks.length === 0 ? (
                <View className="pb-lg">
                  <EmptyState icon={<BookOpen size={24} color="#a8a29e" />} title="No titles sold"
                    description="Best sellers appear once sales are logged." />
                </View>
              ) : (
                <View className="px-lg pb-lg gap-sm">
                  {data.topBooks.map((b: any, i: number) => (
                    <View key={b.sku} className="flex-row items-center rounded-xl bg-stone-50 border border-stone-100 p-md">
                      <View className="w-7 h-7 rounded-full bg-amber-100 items-center justify-center mr-sm">
                        <Text className="text-amber-700 font-extrabold text-xs">{i + 1}</Text>
                      </View>
                      <View className="flex-1 pr-sm">
                        <Text className="text-stone-900 font-semibold text-sm" numberOfLines={1}>{b.title}</Text>
                        <Text className="text-stone-400 text-xs">{b.sku}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-amber-700 font-extrabold text-sm">{b.copies}</Text>
                        <Text className="text-stone-400 text-xs">copies</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── Profit Margin ── */}
            {margin && (
              <>
                <View className="mx-lg mt-md rounded-2xl bg-emerald-700 p-xl">
                  <View className="flex-row items-center justify-between mb-xs">
                    <Text className="text-emerald-100 text-xs tracking-widest font-semibold uppercase">Net Margin</Text>
                    <ExportButton path={`/api/reports/export/margin.csv${exportBase}`} label="CSV" />
                  </View>
                  <Text className="text-white text-3xl font-extrabold mt-xs">{inr(margin.overall.margin)}</Text>
                  <View className="flex-row mt-md pt-sm border-t border-emerald-500/40 gap-xl">
                    <View>
                      <Text className="text-emerald-200 text-xs font-medium">REVENUE</Text>
                      <Text className="text-white font-extrabold">{inr(margin.overall.revenue)}</Text>
                    </View>
                    <View>
                      <Text className="text-emerald-200 text-xs font-medium">COST</Text>
                      <Text className="text-white font-extrabold">{inr(margin.overall.cost)}</Text>
                    </View>
                    <View>
                      <Text className="text-emerald-200 text-xs font-medium">MARGIN %</Text>
                      <Text className="text-white font-extrabold">{margin.overall.marginPct.toFixed(1)}%</Text>
                    </View>
                  </View>
                </View>

                {/* Margin by category */}
                {margin.byCategory.length > 0 && (
                  <View className="mx-lg mt-md rounded-2xl bg-white border border-stone-200 overflow-hidden">
                    <View className="px-lg pt-lg pb-md flex-row items-center gap-sm">
                      <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center">
                        <Percent size={16} color="#059669" />
                      </View>
                      <Text className="text-stone-900 text-base font-extrabold">Margin by Category</Text>
                    </View>
                    <View className="px-lg pb-lg gap-sm">
                      {margin.byCategory.map((c: any) => (
                        <View key={c.category} className="rounded-xl bg-stone-50 border border-stone-100 p-md">
                          <View className="flex-row justify-between items-center">
                            <Text className="text-stone-900 font-semibold flex-1 pr-sm text-sm" numberOfLines={1}>{c.category}</Text>
                            <Text className={`font-extrabold text-sm ${c.margin >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{inr(c.margin)}</Text>
                          </View>
                          <Text className="text-stone-400 text-xs mt-xs">
                            Rev {inr(c.revenue)} · Cost {inr(c.cost)} · {c.marginPct.toFixed(1)}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Margin by distributor */}
                {margin.byDistributor.length > 0 && (
                  <View className="mx-lg mt-md rounded-2xl bg-white border border-stone-200 overflow-hidden">
                    <View className="px-lg pt-lg pb-md flex-row items-center gap-sm">
                      <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center">
                        <Users size={16} color="#2563eb" />
                      </View>
                      <Text className="text-stone-900 text-base font-extrabold">Margin by Distributor</Text>
                    </View>
                    <View className="px-lg pb-lg gap-sm">
                      {margin.byDistributor.map((d: any) => (
                        <View key={d.distributorId} className="flex-row items-center justify-between rounded-xl bg-stone-50 border border-stone-100 p-md">
                          <Text className="text-stone-900 font-semibold flex-1 pr-sm text-sm" numberOfLines={1}>{d.name}</Text>
                          <View className="items-end">
                            <Text className={`font-extrabold text-sm ${d.margin >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{inr(d.margin)}</Text>
                            <Text className="text-stone-400 text-xs">{d.marginPct.toFixed(1)}%</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ── Remittances Export ── */}
            <View className="mx-lg mt-md rounded-xl bg-white border border-stone-200 p-md flex-row items-center justify-between">
              <View>
                <Text className="text-stone-900 font-semibold text-sm">Remittances Report</Text>
                <Text className="text-stone-500 text-xs mt-xs">Download full remittance history</Text>
              </View>
              <ExportButton path={`/api/reports/export/remittances.csv${distributorFilter !== "all" ? `?distributorId=${distributorFilter}` : ""}`} label="CSV" />
            </View>

            {/* ── Filters section ── */}
            <View className="mx-lg mt-md rounded-2xl bg-white border border-stone-200 p-lg">
              <Text className="text-stone-900 font-extrabold text-base mb-md">Filter Reports</Text>

              <Text className="text-stone-500 text-xs uppercase tracking-wide mb-sm">Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm mb-md">
                <Chip label="All" active={categoryFilter === "all"} onPress={() => setCategoryFilter("all")} />
                {categories.map((c) => (
                  <Chip key={c} label={c} active={categoryFilter === c} onPress={() => setCategoryFilter(c)} />
                ))}
              </ScrollView>

              <Text className="text-stone-500 text-xs uppercase tracking-wide mb-sm">Distributor</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm">
                <Chip label="All" active={distributorFilter === "all"} onPress={() => setDistributorFilter("all")} />
                {distributors.map((d) => (
                  <Chip key={d.id} label={d.name} active={distributorFilter === d.id} onPress={() => setDistributorFilter(d.id)} />
                ))}
              </ScrollView>
            </View>
          </>
        )}
      </ScrollView>

      {/* Calendar Modal */}
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

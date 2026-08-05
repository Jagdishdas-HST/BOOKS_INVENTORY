
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { haptics } from "@/lib/haptics";

export function Button({ label, onPress, variant = "primary", disabled, loading }: {
  label: string; onPress: () => void; variant?: "primary" | "secondary" | "danger"; disabled?: boolean; loading?: boolean;
}) {
  const bg = variant === "primary" ? "bg-amber-600" : variant === "danger" ? "bg-rose-600" : "bg-stone-200";
  const fg = variant === "secondary" ? "text-stone-900" : "text-white";
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={() => { haptics.medium(); onPress(); }}
      className={`rounded-xl ${bg} py-md items-center justify-center flex-row gap-sm ${disabled || loading ? "opacity-50" : "active:opacity-80"}`}
    >
      {loading && <ActivityIndicator color={variant === "secondary" ? "#292524" : "#fff"} size="small" />}
      <Text className={`${fg} font-semibold text-base`}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={() => { haptics.selection(); onPress(); }}
      className={`self-start rounded-full border px-md py-xs ${active ? "border-amber-600 bg-amber-600" : "border-stone-300 bg-transparent"}`}
    >
      <Text className={active ? "text-white text-sm font-semibold" : "text-stone-600 text-sm font-medium"}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <View className="items-center justify-center py-3xl px-lg">
      <View className="w-16 h-16 rounded-full bg-stone-100 items-center justify-center mb-md">{icon}</View>
      <Text className="text-stone-900 font-semibold text-base">{title}</Text>
      <Text className="text-stone-500 text-sm mt-xs text-center">{description}</Text>
    </View>
  );
}

export function Skeleton({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-sm">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className="h-20 rounded-xl bg-stone-200" />
      ))}
    </View>
  );
}

export function StatCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "danger" | "success" }) {
  const color = tone === "danger" ? "text-rose-600" : tone === "success" ? "text-emerald-600" : "text-stone-900";
  return (
    <View className="flex-1 rounded-xl bg-white border border-stone-200 p-md">
      <Text className="text-stone-500 text-xs uppercase tracking-wide">{label}</Text>
      <Text className={`${color} text-xl font-extrabold mt-xs`}>{value}</Text>
    </View>
  );
}

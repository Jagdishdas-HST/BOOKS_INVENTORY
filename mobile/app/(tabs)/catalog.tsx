
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Plus, BookOpen, ChevronRight } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Skeleton, EmptyState, Chip } from "@/components/ui";

export default function Catalog() {
  const router = useRouter();
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("All");

  const load = useCallback(async () => {
    try { setBooks(await authFetch("/api/books")); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const categories = ["All", ...Array.from(new Set(books.map((b) => b.category)))];
  const filtered = filter === "All" ? books : books.filter((b) => b.category === filter);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center justify-between px-lg pt-md pb-sm">
        <Text className="text-stone-900 text-2xl font-extrabold">Book Catalog</Text>
        <Pressable onPress={() => router.push("/book/new")} accessibilityLabel="Add book"
          className="w-10 h-10 rounded-full bg-amber-600 items-center justify-center active:opacity-80">
          <Plus size={20} color="#fff" />
        </Pressable>
      </View>

      <View className="py-xs">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-lg gap-sm">
          {categories.map((c) => <Chip key={c} label={c} active={filter === c} onPress={() => setFilter(c)} />)}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl pt-sm" showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}>
        {loading ? <Skeleton count={5} /> : filtered.length === 0 ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState icon={<BookOpen size={26} color="#a8a29e" />} title="No books yet" description="Tap + to add your first title to the catalog." />
          </View>
        ) : (
          <View className="gap-sm">
            {filtered.map((b) => (
              <Pressable key={b.id} onPress={() => router.push({ pathname: "/book/[id]", params: { id: String(b.id) } })}
                className="rounded-xl bg-white border border-stone-200 p-md active:opacity-80">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-sm">
                    <Text className="text-stone-900 font-semibold" numberOfLines={1}>{b.title}</Text>
                    <Text className="text-stone-500 text-xs mt-xs">{b.sku} · {b.language}{!b.active ? " · retired" : ""}</Text>
                  </View>
                  <ChevronRight size={18} color="#a8a29e" />
                </View>
                <View className="flex-row gap-md mt-sm pt-sm border-t border-stone-100">
                  <Text className="text-stone-500 text-xs">Retail <Text className="text-stone-900 font-semibold">₹{b.retailPrice}</Text></Text>
                  <Text className="text-stone-500 text-xs">Cost <Text className="text-stone-900 font-semibold">₹{b.costPrice}</Text></Text>
                  <Text className="text-stone-500 text-xs">Warehouse <Text className="text-amber-700 font-semibold">{b.warehouseStock}</Text></Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Plus, BookOpen, ChevronRight, PackagePlus } from "lucide-react-native";
import { authFetch, useAuth } from "@/lib/auth";
import { Skeleton, EmptyState, Chip } from "@/components/ui";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useIsOnline, startConnectivityPolling } from "@/lib/connectivity";
import { saveCatalogCache, loadCatalogCache, type CatalogBook } from "@/lib/offlineCache";

export default function Catalog() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";
  const online = useIsOnline();

  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    startConnectivityPolling();
    // Load cache immediately.
    loadCatalogCache().then((c) => {
      if (c) {
        setBooks(c.data);
        setCachedAt(c.cachedAt);
        setLoading(false);
      }
    });
  }, []);

  const load = useCallback(async () => {
    if (!online) {
      // Already loaded from cache above; just stop the spinner.
      setLoading(false);
      return;
    }
    try {
      const data = await authFetch("/api/books");
      setBooks(data);
      const now = new Date().toISOString();
      setCachedAt(now);
      await saveCatalogCache(data);
    } catch {}
    setLoading(false);
  }, [online]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const categories = ["All", ...Array.from(new Set(books.map((b) => b.category)))];
  const filtered = filter === "All" ? books : books.filter((b) => b.category === filter);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center justify-between px-lg pt-md pb-sm">
        <Text className="text-stone-900 text-2xl font-extrabold">Book Catalog</Text>
        {isAdmin && online && (
          <View className="flex-row gap-sm">
            <Pressable
              onPress={() => router.push("/stock/intake")}
              accessibilityLabel="Stock intake"
              className="w-10 h-10 rounded-full bg-emerald-600 items-center justify-center active:opacity-80"
            >
              <PackagePlus size={20} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => router.push("/book/new")}
              accessibilityLabel="Add book"
              className="w-10 h-10 rounded-full bg-amber-600 items-center justify-center active:opacity-80"
            >
              <Plus size={20} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>

      {/* Offline banner — catalog is read-only offline */}
      {!online && (
        <View className="mx-lg mb-sm rounded-xl bg-amber-50 border border-amber-200 p-sm flex-row items-center gap-sm">
          <BookOpen size={14} color="#d97706" />
          <Text className="text-amber-800 text-xs flex-1">
            Offline — read-only catalog{cachedAt ? ` · as of ${new Date(cachedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}` : ""}
          </Text>
        </View>
      )}

      <View className="py-xs">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-lg gap-sm"
        >
          {categories.map((c) => (
            <Chip key={c} label={c} active={filter === c} onPress={() => setFilter(c)} />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-lg pb-3xl pt-sm"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}
      >
        {loading ? (
          <Skeleton count={5} />
        ) : filtered.length === 0 ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState
              icon={<BookOpen size={26} color="#a8a29e" />}
              title={online ? "No books yet" : "No cached catalog"}
              description={online ? "Tap + to add your first title to the catalog." : "Connect to the internet to load the catalog."}
            />
          </View>
        ) : (
          <View className="gap-sm">
            {filtered.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => {
                  if (!isAdmin || !online) return; // Read-only offline
                  router.push({ pathname: "/book/[id]", params: { id: String(b.id) } });
                }}
                className={`rounded-xl bg-white border border-stone-200 p-md ${isAdmin && online ? "active:opacity-80" : ""}`}
              >
                <View className="flex-row items-center">
                  {b.coverUrl ? (
                    <Image source={b.coverUrl} style={{ width: 44, height: 60, borderRadius: 6 }} contentFit="cover" />
                  ) : (
                    <View className="w-11 rounded-md bg-stone-100 items-center justify-center" style={{ height: 60 }}>
                      <BookOpen size={20} color="#d6d3d1" />
                    </View>
                  )}
                  <View className="flex-1 px-sm">
                    <Text className="text-stone-900 font-semibold" numberOfLines={1}>{b.title}</Text>
                    <Text className="text-stone-500 text-xs mt-xs">
                      {b.sku} · {b.language}{!b.active ? " · retired" : ""}
                    </Text>
                    <View className="flex-row gap-md mt-sm">
                      <Text className="text-stone-500 text-xs">
                        Retail <Text className="text-stone-900 font-semibold">₹{b.retailPrice}</Text>
                      </Text>
                      {isAdmin && (
                        <Text className="text-stone-500 text-xs">
                          Warehouse <Text className="text-amber-700 font-semibold">{b.warehouseStock}</Text>
                        </Text>
                      )}
                    </View>
                  </View>
                  {isAdmin && online && <ChevronRight size={18} color="#a8a29e" />}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

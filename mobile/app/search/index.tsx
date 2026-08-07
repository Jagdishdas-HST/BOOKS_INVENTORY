
import { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, Search as SearchIcon, BookOpen, Receipt, Users, HandCoins, WifiOff } from "lucide-react-native";
import { format } from "date-fns";
import { authFetch, useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/ui";
import { useIsOnline } from "@/lib/connectivity";

export default function Search() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const online = useIsOnline();
  const isAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const timer = useRef<any>(null);

  const run = useCallback(async (query: string) => {
    if (!query.trim()) { setData(null); setError(""); return; }
    if (!online) {
      setError("Search requires a connection. Reconnect and try again.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setData(await authFetch(`/api/search?q=${encodeURIComponent(query.trim())}`));
    } catch (e: any) {
      setError(e?.message || "Search failed");
    }
    setLoading(false);
  }, [online]);

  const onChange = (t: string) => {
    setQ(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(t), 300);
  };

  const hasResults = data && (
    data.books?.length || data.sales?.length || data.distributors?.length || data.remittances?.length
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Search</Text>
      </View>

      {/* Offline banner */}
      {!online && (
        <View className="mx-lg mb-sm rounded-xl bg-amber-50 border border-amber-200 p-md flex-row items-center gap-sm">
          <WifiOff size={16} color="#d97706" />
          <Text className="text-amber-800 text-sm flex-1">
            Search requires a connection. Reconnect to search the catalog.
          </Text>
        </View>
      )}

      <View className="px-lg pb-sm">
        <View className="flex-row items-center rounded-xl bg-white border border-stone-200 px-md">
          <SearchIcon size={18} color="#a8a29e" />
          <TextInput
            value={q}
            onChangeText={onChange}
            autoFocus
            placeholder={isAdmin ? "Books, sales, distributors…" : "Books & your sales…"}
            placeholderTextColor="#a8a29e"
            className="flex-1 px-sm py-md text-stone-900"
            editable={online}
          />
          {loading && <ActivityIndicator size="small" color="#d97706" />}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl pt-sm" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!online ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState
              icon={<WifiOff size={26} color="#a8a29e" />}
              title="No connection"
              description="Connect to the internet to search the catalog and sales records."
            />
          </View>
        ) : error ? (
          <View className="rounded-xl bg-rose-50 border border-rose-200 p-md mt-lg">
            <Text className="text-rose-700 text-sm">{error}</Text>
          </View>
        ) : !q.trim() ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState icon={<SearchIcon size={26} color="#a8a29e" />} title="Search the catalog" description={isAdmin ? "Find books, sales and distributors." : "Find books and your own sales."} />
          </View>
        ) : !loading && !hasResults ? (
          <View className="rounded-xl bg-white border border-stone-200 mt-lg">
            <EmptyState icon={<SearchIcon size={26} color="#a8a29e" />} title="No matches" description={`Nothing found for "${q.trim()}".`} />
          </View>
        ) : (
          <View className="gap-lg">
            {data?.books?.length > 0 && (
              <View>
                <View className="flex-row items-center gap-xs mb-sm">
                  <BookOpen size={16} color="#292524" />
                  <Text className="text-stone-900 font-bold">Books</Text>
                </View>
                <View className="gap-sm">
                  {data.books.map((b: any) => (
                    <Pressable key={b.id} onPress={() => router.push({ pathname: "/book/[id]", params: { id: String(b.id) } })}
                      className="rounded-xl bg-white border border-stone-200 p-md active:opacity-80">
                      <Text className="text-stone-900 font-semibold" numberOfLines={1}>{b.title}</Text>
                      <Text className="text-stone-500 text-xs mt-xs">{b.sku}{b.isbn ? ` · ISBN ${b.isbn}` : ""} · ₹{b.retailPrice}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {data?.distributors?.length > 0 && (
              <View>
                <View className="flex-row items-center gap-xs mb-sm">
                  <Users size={16} color="#292524" />
                  <Text className="text-stone-900 font-bold">Distributors</Text>
                </View>
                <View className="gap-sm">
                  {data.distributors.map((d: any) => (
                    <Pressable key={d.id} onPress={() => router.push({ pathname: "/distributor/[id]", params: { id: String(d.id), name: d.name } })}
                      className="flex-row items-center justify-between rounded-xl bg-white border border-stone-200 p-md active:opacity-80">
                      <Text className="text-stone-900 font-semibold">{d.name}</Text>
                      <Text className="text-stone-500 text-xs">@{d.username}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {data?.sales?.length > 0 && (
              <View>
                <View className="flex-row items-center gap-xs mb-sm">
                  <Receipt size={16} color="#292524" />
                  <Text className="text-stone-900 font-bold">Sales</Text>
                </View>
                <View className="gap-sm">
                  {data.sales.map((s: any) => (
                    <View key={s.id} className="rounded-xl bg-white border border-stone-200 p-md">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{s.bookTitle}</Text>
                        <Text className="text-stone-900 font-bold">{s.paymentType === "free" ? "₹0" : `₹${s.totalValue}`}</Text>
                      </View>
                      <Text className="text-stone-500 text-xs mt-xs">
                        {s.paymentType.toUpperCase()}{s.distributorName ? ` · ${s.distributorName}` : ""} · {format(new Date(s.createdAt), "d MMM")}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {data?.remittances?.length > 0 && (
              <View>
                <View className="flex-row items-center gap-xs mb-sm">
                  <HandCoins size={16} color="#292524" />
                  <Text className="text-stone-900 font-bold">Remittances</Text>
                </View>
                <View className="gap-sm">
                  {data.remittances.map((r: any) => (
                    <View key={r.id} className="flex-row items-center justify-between rounded-xl bg-white border border-stone-200 p-md">
                      <Text className="text-stone-500 text-xs flex-1">{r.note || "No note"} · {format(new Date(r.createdAt), "d MMM")}</Text>
                      <Text className="text-emerald-700 font-bold">₹{r.amount}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

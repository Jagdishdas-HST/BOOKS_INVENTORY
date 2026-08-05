
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, Check } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button, Skeleton } from "@/components/ui";
import { haptics } from "@/lib/haptics";

const REASONS: { key: "unsold" | "damaged" | "reassigned"; label: string; hint: string }[] = [
  { key: "unsold", label: "Unsold", hint: "Returned to sellable warehouse stock" },
  { key: "damaged", label: "Damaged", hint: "Routed to write-off, not sellable stock" },
  { key: "reassigned", label: "Reassigned", hint: "Returned to warehouse for reassignment" },
];

export default function ReturnStock() {
  const router = useRouter();
  const [dists, setDists] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [dist, setDist] = useState<any>(null);
  const [book, setBook] = useState<any>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<"unsold" | "damaged" | "reassigned">("unsold");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch("/api/users/distributors").then((d) => {
      setDists(d.filter((x: any) => x.active)); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const selectDist = async (d: any) => {
    setDist(d); setBook(null); setHoldings([]); haptics.selection();
    setLoadingHoldings(true);
    try {
      const h = await authFetch(`/api/stock/holdings?distributorId=${d.id}`);
      setHoldings(h.filter((x: any) => x.quantity > 0));
    } catch {}
    setLoadingHoldings(false);
  };

  const submit = async () => {
    setError("");
    if (!dist) { setError("Select a distributor"); return; }
    if (!book) { setError("Select a book held by them"); return; }
    const q = parseInt(qty, 10);
    if (!q || q < 1) { setError("Enter a valid quantity"); return; }
    if (q > book.quantity) { setError(`They only hold ${book.quantity}`); return; }
    setSaving(true);
    try {
      await authFetch("/api/stock/return", { method: "POST", body: JSON.stringify({ bookId: book.bookId, distributorId: dist.id, quantity: q, reason }) });
      haptics.success();
      router.back();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Return Stock</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        {loading ? <Skeleton count={4} /> : (
          <>
            <Text className="text-stone-600 text-sm font-medium mb-sm">Distributor</Text>
            <View className="gap-sm">
              {dists.map((d) => (
                <Pressable key={d.id} onPress={() => selectDist(d)}
                  className={`flex-row items-center justify-between rounded-xl border p-md ${dist?.id === d.id ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}>
                  <Text className="text-stone-900 font-semibold">{d.name}</Text>
                  {dist?.id === d.id && <Check size={18} color="#d97706" />}
                </Pressable>
              ))}
            </View>

            {dist && (
              <>
                <Text className="text-stone-600 text-sm font-medium mt-lg mb-sm">Book held by {dist.name.split(" ")[0]}</Text>
                {loadingHoldings ? <Skeleton count={3} /> : holdings.length === 0 ? (
                  <View className="rounded-xl bg-white border border-stone-200 p-md">
                    <Text className="text-stone-500 text-sm">This distributor holds no stock to return.</Text>
                  </View>
                ) : (
                  <View className="gap-sm">
                    {holdings.map((h) => (
                      <Pressable key={h.id} onPress={() => { setBook(h); haptics.selection(); }}
                        className={`flex-row items-center justify-between rounded-xl border p-md ${book?.id === h.id ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}>
                        <View className="flex-1">
                          <Text className="text-stone-900 font-semibold" numberOfLines={1}>{h.title}</Text>
                          <Text className="text-stone-500 text-xs">Holds {h.quantity}</Text>
                        </View>
                        {book?.id === h.id && <Check size={18} color="#d97706" />}
                      </Pressable>
                    ))}
                  </View>
                )}

                <Text className="text-stone-600 text-sm font-medium mt-lg mb-sm">Reason</Text>
                <View className="gap-sm">
                  {REASONS.map((r) => (
                    <Pressable key={r.key} onPress={() => { setReason(r.key); haptics.selection(); }}
                      className={`rounded-xl border p-md ${reason === r.key ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-stone-900 font-semibold">{r.label}</Text>
                        {reason === r.key && <Check size={18} color="#d97706" />}
                      </View>
                      <Text className="text-stone-500 text-xs mt-xs">{r.hint}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text className="text-stone-600 text-sm font-medium mt-lg mb-xs">Quantity</Text>
                <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" placeholder="10" placeholderTextColor="#a8a29e"
                  className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900 text-lg" />

                {error ? <Text className="text-rose-600 text-sm mt-sm">{error}</Text> : null}
                <View className="mt-lg">
                  <Button label="Record Return" onPress={submit} loading={saving} />
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

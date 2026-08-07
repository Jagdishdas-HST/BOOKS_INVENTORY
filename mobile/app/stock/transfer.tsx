
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, Check, ArrowRight } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button, Skeleton } from "@/components/ui";
import { haptics } from "@/lib/haptics";

export default function TransferStock() {
  const router = useRouter();
  const [dists, setDists] = useState<any[]>([]);
  const [fromDist, setFromDist] = useState<any>(null);
  const [toDist, setToDist] = useState<any>(null);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [book, setBook] = useState<any>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch("/api/users/distributors").then((d) => {
      setDists(d.filter((x: any) => x.active)); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    setBook(null); setHoldings([]);
    if (!fromDist) return;
    setLoadingHoldings(true);
    authFetch(`/api/stock/holdings?distributorId=${fromDist.id}`)
      .then((h) => setHoldings(h.filter((x: any) => x.quantity > 0)))
      .catch(() => {})
      .finally(() => setLoadingHoldings(false));
  }, [fromDist]);

  const submit = async () => {
    setError("");
    if (!fromDist) { setError("Select the source distributor"); return; }
    if (!toDist) { setError("Select the destination distributor"); return; }
    if (fromDist.id === toDist.id) { setError("Source and destination must differ"); return; }
    if (!book) { setError("Select a book to transfer"); return; }
    const q = parseInt(qty, 10);
    if (!q || q < 1) { setError("Enter a valid quantity"); return; }
    if (q > book.quantity) { setError(`${fromDist.name} only holds ${book.quantity}`); return; }
    setSaving(true);
    try {
      await authFetch("/api/stock/transfer", { method: "POST", body: JSON.stringify({
        bookId: book.bookId, fromDistributorId: fromDist.id, toDistributorId: toDist.id, quantity: q, reason: reason.trim() || null,
      }) });
      haptics.success();
      router.back();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Transfer Stock</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        {loading ? <Skeleton count={4} /> : (
          <>
            <Text className="text-stone-600 text-sm font-medium mb-sm">From distributor</Text>
            <View className="gap-sm">
              {dists.map((d) => (
                <Pressable key={d.id} onPress={() => { setFromDist(d); haptics.selection(); }}
                  className={`flex-row items-center justify-between rounded-xl border p-md ${fromDist?.id === d.id ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}>
                  <Text className="text-stone-900 font-semibold">{d.name}</Text>
                  {fromDist?.id === d.id && <Check size={18} color="#d97706" />}
                </Pressable>
              ))}
            </View>

            {fromDist && (
              <>
                <Text className="text-stone-600 text-sm font-medium mt-lg mb-sm">Book to transfer</Text>
                {loadingHoldings ? <Skeleton count={2} /> : holdings.length === 0 ? (
                  <Text className="text-stone-500 text-sm">{fromDist.name} holds no stock.</Text>
                ) : (
                  <View className="gap-sm">
                    {holdings.map((h) => (
                      <Pressable key={h.id} onPress={() => { setBook(h); haptics.selection(); }}
                        className={`flex-row items-center justify-between rounded-xl border p-md ${book?.id === h.id ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}>
                        <View className="flex-1">
                          <Text className="text-stone-900 font-semibold" numberOfLines={1}>{h.title}</Text>
                          <Text className="text-stone-500 text-xs">holds {h.quantity}</Text>
                        </View>
                        {book?.id === h.id && <Check size={18} color="#d97706" />}
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}

            <Text className="text-stone-600 text-sm font-medium mt-lg mb-sm">To distributor</Text>
            <View className="gap-sm">
              {dists.filter((d) => d.id !== fromDist?.id).map((d) => (
                <Pressable key={d.id} onPress={() => { setToDist(d); haptics.selection(); }}
                  className={`flex-row items-center justify-between rounded-xl border p-md ${toDist?.id === d.id ? "border-emerald-600 bg-emerald-50" : "border-stone-200 bg-white"}`}>
                  <Text className="text-stone-900 font-semibold">{d.name}</Text>
                  {toDist?.id === d.id && <Check size={18} color="#059669" />}
                </Pressable>
              ))}
            </View>

            {fromDist && toDist && book ? (
              <View className="flex-row items-center justify-center gap-sm mt-lg rounded-xl bg-white border border-stone-200 p-md">
                <Text className="text-stone-900 font-semibold flex-1 text-right" numberOfLines={1}>{fromDist.name}</Text>
                <ArrowRight size={18} color="#d97706" />
                <Text className="text-stone-900 font-semibold flex-1" numberOfLines={1}>{toDist.name}</Text>
              </View>
            ) : null}

            <Text className="text-stone-600 text-sm font-medium mt-lg mb-xs">Quantity</Text>
            <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" placeholder="10" placeholderTextColor="#a8a29e"
              className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900 text-lg" />

            <Text className="text-stone-600 text-sm font-medium mt-md mb-xs">Reason (optional)</Text>
            <TextInput value={reason} onChangeText={setReason} placeholder="e.g. covering a festival stall" placeholderTextColor="#a8a29e"
              className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />

            {error ? <Text className="text-rose-600 text-sm mt-sm">{error}</Text> : null}

            <View className="mt-lg">
              <Button label="Transfer Stock" onPress={submit} loading={saving} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

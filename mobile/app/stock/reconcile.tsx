
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, Check } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button, Skeleton, Chip } from "@/components/ui";
import { haptics } from "@/lib/haptics";

export default function ReconcileStock() {
  const router = useRouter();
  const [books, setBooks] = useState<any[]>([]);
  const [dists, setDists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState<any>(null);
  const [scope, setScope] = useState<"warehouse" | "distributor">("warehouse");
  const [dist, setDist] = useState<any>(null);
  const [distHolding, setDistHolding] = useState<number | null>(null);
  const [physical, setPhysical] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([authFetch("/api/books"), authFetch("/api/users/distributors")]).then(([b, d]) => {
      setBooks(b.filter((x: any) => x.active)); setDists(d.filter((x: any) => x.active)); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadDistHolding = async (d: any, b: any) => {
    if (!d || !b) { setDistHolding(null); return; }
    try {
      const h = await authFetch(`/api/stock/holdings?distributorId=${d.id}`);
      const match = h.find((x: any) => x.bookId === b.id);
      setDistHolding(match?.quantity ?? 0);
    } catch { setDistHolding(0); }
  };

  const systemCount = scope === "warehouse" ? (book?.warehouseStock ?? 0) : (distHolding ?? 0);
  const physicalNum = physical === "" ? null : parseInt(physical, 10);
  const variance = physicalNum === null || Number.isNaN(physicalNum) ? null : physicalNum - systemCount;

  const submit = async () => {
    setError("");
    if (!book) { setError("Select a book"); return; }
    if (scope === "distributor" && !dist) { setError("Select a distributor"); return; }
    if (physicalNum === null || Number.isNaN(physicalNum) || physicalNum < 0) { setError("Enter a valid physical count"); return; }
    setSaving(true);
    try {
      await authFetch("/api/stock/reconcile", { method: "POST", body: JSON.stringify({
        bookId: book.id,
        distributorId: scope === "distributor" ? dist.id : null,
        physicalCount: physicalNum,
        note: note.trim() || null,
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
        <Text className="text-stone-900 text-xl font-extrabold">Reconcile Stock</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        {loading ? <Skeleton count={4} /> : (
          <>
            <Text className="text-stone-600 text-sm font-medium mb-sm">Count location</Text>
            <View className="py-xs mb-md">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm">
                <Chip label="Warehouse" active={scope === "warehouse"} onPress={() => { setScope("warehouse"); setDist(null); setDistHolding(null); }} />
                <Chip label="Per distributor" active={scope === "distributor"} onPress={() => setScope("distributor")} />
              </ScrollView>
            </View>

            <Text className="text-stone-600 text-sm font-medium mb-sm">Book</Text>
            <View className="gap-sm">
              {books.map((b) => (
                <Pressable key={b.id} onPress={() => { setBook(b); haptics.selection(); if (scope === "distributor") loadDistHolding(dist, b); }}
                  className={`flex-row items-center justify-between rounded-xl border p-md ${book?.id === b.id ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}>
                  <View className="flex-1">
                    <Text className="text-stone-900 font-semibold" numberOfLines={1}>{b.title}</Text>
                    <Text className="text-stone-500 text-xs">Warehouse: {b.warehouseStock}</Text>
                  </View>
                  {book?.id === b.id && <Check size={18} color="#d97706" />}
                </Pressable>
              ))}
            </View>

            {scope === "distributor" && (
              <>
                <Text className="text-stone-600 text-sm font-medium mt-lg mb-sm">Distributor</Text>
                <View className="gap-sm">
                  {dists.map((d) => (
                    <Pressable key={d.id} onPress={() => { setDist(d); haptics.selection(); loadDistHolding(d, book); }}
                      className={`flex-row items-center justify-between rounded-xl border p-md ${dist?.id === d.id ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}>
                      <Text className="text-stone-900 font-semibold">{d.name}</Text>
                      {dist?.id === d.id && <Check size={18} color="#d97706" />}
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {book && (scope === "warehouse" || dist) && (
              <View className="rounded-xl bg-white border border-stone-200 p-md mt-lg">
                <View className="flex-row justify-between">
                  <Text className="text-stone-500 text-sm">System count</Text>
                  <Text className="text-stone-900 font-bold">{systemCount}</Text>
                </View>
                {variance !== null && (
                  <View className="flex-row justify-between mt-xs">
                    <Text className="text-stone-500 text-sm">Variance</Text>
                    <Text className={`font-bold ${variance === 0 ? "text-stone-900" : variance > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {variance > 0 ? "+" : ""}{variance}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Text className="text-stone-600 text-sm font-medium mt-lg mb-xs">Physical count</Text>
            <TextInput value={physical} onChangeText={setPhysical} keyboardType="number-pad" placeholder="0" placeholderTextColor="#a8a29e"
              className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900 text-lg" />

            <Text className="text-stone-600 text-sm font-medium mt-md mb-xs">Note (explain the variance)</Text>
            <TextInput value={note} onChangeText={setNote} multiline placeholder="e.g. 3 copies water-damaged in storage" placeholderTextColor="#a8a29e"
              className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900 min-h-[70px]" />

            {error ? <Text className="text-rose-600 text-sm mt-sm">{error}</Text> : null}
            <View className="mt-lg">
              <Button label="Confirm & Adjust" onPress={submit} loading={saving} />
            </View>
            <Text className="text-stone-400 text-xs mt-sm text-center">This correction is recorded in the audit log — never a silent edit.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

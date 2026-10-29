
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { ChevronLeft, Check, PackagePlus } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button, Skeleton } from "@/components/ui";
import { haptics } from "@/lib/haptics";

export default function StockIntake() {
  const router = useRouter();
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState<any>(null);
  const [qty, setQty] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch("/api/books").then((r) => { setBooks(r.filter((b: any) => b.active)); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const submit = async () => {
    setError("");
    if (!book) { setError("Select a book"); return; }
    const q = parseInt(qty, 10);
    if (!q || q < 1) { setError("Enter quantity received"); return; }
    setSaving(true);
    try {
      await authFetch("/api/stock/intake", { method: "POST", body: JSON.stringify({ bookId: book.id, quantity: q, reference: reference.trim() || null }) });
      haptics.success();
      router.back();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Stock Intake</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-sm rounded-xl bg-emerald-50 border border-emerald-200 p-md mb-lg">
          <PackagePlus size={20} color="#059669" />
          <Text className="text-emerald-800 text-sm flex-1">Record a new print run arriving at the warehouse. This adds to warehouse stock.</Text>
        </View>

        <Text className="text-stone-600 text-sm font-medium mb-sm">Select Book</Text>
        {loading ? <Skeleton count={3} /> : (
          <View className="gap-sm">
            {books.map((b) => (
              <Pressable key={b.id} onPress={() => setBook(b)}
                className={`flex-row items-center rounded-xl border p-md ${book?.id === b.id ? "border-emerald-600 bg-emerald-50" : "border-stone-200 bg-white"}`}>
                {b.coverUrl ? (
                  <Image source={b.coverUrl} style={{ width: 40, height: 56, borderRadius: 6 }} contentFit="cover" />
                ) : (
                  <View className="w-10 h-14 rounded-md bg-stone-100 items-center justify-center"><Text className="text-stone-300 text-lg">📖</Text></View>
                )}
                <View className="flex-1 ml-sm">
                  <Text className="text-stone-900 font-semibold" numberOfLines={1}>{b.title}</Text>
                  <Text className="text-stone-500 text-xs">{b.sku} · {b.warehouseStock} in warehouse</Text>
                </View>
                {book?.id === b.id && <Check size={18} color="#059669" />}
              </Pressable>
            ))}
          </View>
        )}

        {book && (
          <>
            <View className="mt-lg mb-md">
              <Text className="text-stone-600 text-sm font-medium mb-xs">Quantity received</Text>
              <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" placeholder="500" placeholderTextColor="#a8a29e"
                className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
            </View>
            <View className="mb-md">
              <Text className="text-stone-600 text-sm font-medium mb-xs">Reference (optional)</Text>
              <TextInput value={reference} onChangeText={setReference} placeholder="PO #, printer invoice, supplier" placeholderTextColor="#a8a29e"
                className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
            </View>

            {error ? <Text className="text-rose-600 text-sm mb-sm">{error}</Text> : null}
            <Button label="Record Intake" onPress={submit} loading={saving} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, AlertTriangle } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button, Skeleton } from "@/components/ui";
import { haptics } from "@/lib/haptics";

export default function BookDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const [retail, setRetail] = useState("");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch("/api/books").then((rows) => {
      const b = rows.find((x: any) => String(x.id) === String(id));
      if (b) {
        setBook(b); setTitle(b.title); setCost(String(b.costPrice)); setRetail(String(b.retailPrice));
        setStock(String(b.warehouseStock)); setThreshold(String(b.reorderThreshold ?? 10));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setError(""); setSaving(true);
    try {
      await authFetch(`/api/books/${id}`, { method: "PATCH", body: JSON.stringify({
        title: title.trim(), costPrice: parseFloat(cost), retailPrice: parseFloat(retail),
        warehouseStock: parseInt(stock || "0", 10), reorderThreshold: parseInt(threshold || "0", 10),
      }) });
      haptics.success();
      router.back();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  const toggleRetire = async () => {
    try { await authFetch(`/api/books/${id}`, { method: "PATCH", body: JSON.stringify({ active: !book.active }) }); haptics.medium(); router.back(); } catch (e: any) { setError(e.message); }
  };

  const isLow = book && book.warehouseStock <= (book.reorderThreshold ?? 10);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Edit Book</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        {loading ? <Skeleton count={4} /> : !book ? <Text className="text-stone-500">Book not found.</Text> : (
          <>
            <View className="rounded-xl bg-white border border-stone-200 p-md mb-lg">
              <Text className="text-stone-500 text-xs">{book.sku} · {book.category} · {book.language}</Text>
              {book.writeOffStock > 0 && (
                <Text className="text-rose-600 text-xs mt-xs">Write-off (damaged): {book.writeOffStock} copies</Text>
              )}
            </View>

            {isLow && (
              <View className="flex-row items-center gap-xs rounded-xl bg-rose-50 border border-rose-200 p-md mb-lg">
                <AlertTriangle size={18} color="#e11d48" />
                <Text className="text-rose-700 text-sm font-semibold flex-1">Low stock — at or below reorder threshold.</Text>
              </View>
            )}

            <View className="mb-md">
              <Text className="text-stone-600 text-sm font-medium mb-xs">Title</Text>
              <TextInput value={title} onChangeText={setTitle} className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
            </View>
            <View className="flex-row gap-sm">
              <View className="flex-1 mb-md">
                <Text className="text-stone-600 text-sm font-medium mb-xs">Cost (₹)</Text>
                <TextInput value={cost} onChangeText={setCost} keyboardType="decimal-pad" className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
              </View>
              <View className="flex-1 mb-md">
                <Text className="text-stone-600 text-sm font-medium mb-xs">Retail (₹)</Text>
                <TextInput value={retail} onChangeText={setRetail} keyboardType="decimal-pad" className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
              </View>
            </View>
            <View className="flex-row gap-sm">
              <View className="flex-1 mb-md">
                <Text className="text-stone-600 text-sm font-medium mb-xs">Warehouse stock</Text>
                <TextInput value={stock} onChangeText={setStock} keyboardType="number-pad" className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
              </View>
              <View className="flex-1 mb-md">
                <Text className="text-stone-600 text-sm font-medium mb-xs">Reorder at ≤</Text>
                <TextInput value={threshold} onChangeText={setThreshold} keyboardType="number-pad" placeholder="10" placeholderTextColor="#a8a29e" className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
              </View>
            </View>

            {error ? <Text className="text-rose-600 text-sm mb-sm">{error}</Text> : null}
            <Button label="Save Changes" onPress={save} loading={saving} />
            <View className="mt-sm">
              <Button label={book.active ? "Retire SKU" : "Reactivate SKU"} variant="secondary" onPress={toggleRetire} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

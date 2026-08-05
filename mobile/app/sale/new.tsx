
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, Check } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button, Chip, Skeleton } from "@/components/ui";
import { haptics } from "@/lib/haptics";

export default function NewSale() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState<any>(null);
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [payment, setPayment] = useState<"cash" | "online" | "debt">("cash");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch("/api/stock/holdings").then((h) => { setHoldings(h.filter((x: any) => x.quantity > 0)); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const selectBook = (b: any) => { setBook(b); setPrice(String(b.retailPrice)); haptics.selection(); };

  const submit = async () => {
    setError("");
    if (!book) { setError("Select a book"); return; }
    const q = parseInt(qty, 10);
    if (!q || q < 1) { setError("Enter a valid quantity"); return; }
    if (q > book.quantity) { setError(`You only hold ${book.quantity} copies`); return; }
    setSaving(true);
    try {
      await authFetch("/api/sales", { method: "POST", body: JSON.stringify({ bookId: book.bookId, quantity: q, unitPrice: parseFloat(price), paymentType: payment }) });
      haptics.success();
      router.back();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  const total = book && price ? (parseInt(qty || "0", 10) * parseFloat(price || "0")).toFixed(2) : "0.00";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Log Sale</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        <Text className="text-stone-600 text-sm font-medium mb-sm">Select Book</Text>
        {loading ? <Skeleton count={3} /> : holdings.length === 0 ? (
          <Text className="text-stone-500 text-sm">You have no stock to sell.</Text>
        ) : (
          <View className="gap-sm">
            {holdings.map((h) => (
              <Pressable key={h.id} onPress={() => selectBook(h)}
                className={`flex-row items-center justify-between rounded-xl border p-md ${book?.id === h.id ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}>
                <View className="flex-1">
                  <Text className="text-stone-900 font-semibold" numberOfLines={1}>{h.title}</Text>
                  <Text className="text-stone-500 text-xs">{h.quantity} in hand · ₹{h.retailPrice}</Text>
                </View>
                {book?.id === h.id && <Check size={18} color="#d97706" />}
              </Pressable>
            ))}
          </View>
        )}

        {book && (
          <>
            <View className="flex-row gap-sm mt-lg">
              <View className="flex-1">
                <Text className="text-stone-600 text-sm font-medium mb-xs">Quantity</Text>
                <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad"
                  className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
              </View>
              <View className="flex-1">
                <Text className="text-stone-600 text-sm font-medium mb-xs">Unit Price (₹)</Text>
                <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad"
                  className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
              </View>
            </View>

            <Text className="text-stone-600 text-sm font-medium mt-lg mb-sm">Payment Type</Text>
            <View className="flex-row gap-sm">
              <Chip label="Cash" active={payment === "cash"} onPress={() => setPayment("cash")} />
              <Chip label="Online" active={payment === "online"} onPress={() => setPayment("online")} />
              <Chip label="Debt" active={payment === "debt"} onPress={() => setPayment("debt")} />
            </View>

            <View className="rounded-xl bg-white border border-stone-200 p-md mt-lg flex-row justify-between items-center">
              <Text className="text-stone-500">Total value</Text>
              <Text className="text-stone-900 text-xl font-extrabold">₹{total}</Text>
            </View>

            {error ? <Text className="text-rose-600 text-sm mt-sm">{error}</Text> : null}

            <View className="mt-lg">
              <Button label="Record Sale" onPress={submit} loading={saving} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

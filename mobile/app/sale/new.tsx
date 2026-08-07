
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import {
  ChevronLeft, Check, Gift, WifiOff, CloudUpload, Wifi, BookOpen,
} from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button, Chip, Skeleton } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useOfflineQueue } from "@/lib/offlineQueue";
import { useIsOnline, startConnectivityPolling } from "@/lib/connectivity";
import { loadHoldingsCache, type HoldingItem } from "@/lib/offlineCache";

export default function NewSale() {
  const router = useRouter();
  const enqueue = useOfflineQueue((s) => s.enqueue);
  const online = useIsOnline();

  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [holdingsCachedAt, setHoldingsCachedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState<HoldingItem | null>(null);
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [payment, setPayment] = useState<"cash" | "online" | "debt" | "free">("cash");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    startConnectivityPolling();
    // Load cached holdings first (works offline).
    loadHoldingsCache().then((c) => {
      if (c) {
        setHoldings(c.data.filter((x) => x.quantity > 0));
        setHoldingsCachedAt(c.cachedAt);
        setLoading(false);
      }
    });
    // Then try to fetch live data if online.
    authFetch("/api/stock/holdings")
      .then((h: HoldingItem[]) => {
        setHoldings(h.filter((x) => x.quantity > 0));
        setHoldingsCachedAt(new Date().toISOString());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const selectBook = (b: HoldingItem) => {
    setBook(b);
    setPrice(String(b.retailPrice));
    haptics.selection();
  };

  const isFree = payment === "free";
  const retail = book ? parseFloat(String(book.retailPrice)) : 0;
  const numPrice = parseFloat(price || "0");
  const isDiscounted = !isFree && book && numPrice < retail && numPrice >= 0;

  const submit = async () => {
    setError("");
    if (!book) { setError("Select a book"); return; }
    const q = parseInt(qty, 10);
    if (!q || q < 1) { setError("Enter a valid quantity"); return; }
    if (q > book.quantity) { setError(`You only hold ${book.quantity} copies`); return; }
    setSaving(true);

    const unitPrice = isFree ? 0 : numPrice;
    const totalValue = isFree ? 0 : q * unitPrice;

    if (online) {
      try {
        await authFetch("/api/sales", {
          method: "POST",
          body: JSON.stringify({
            bookId: book.bookId,
            quantity: q,
            unitPrice,
            paymentType: payment,
          }),
        });
        haptics.success();
        router.back();
        return;
      } catch (e: any) {
        // Surface hard validation errors; fall through to queue on network failure.
        if (e?.message && /only hold|stock|Book/i.test(e.message)) {
          setError(e.message);
          setSaving(false);
          return;
        }
        // Network failure — fall through to offline queue.
      }
    }

    // Offline path: queue locally with a field-time timestamp.
    await enqueue({
      bookId: book.bookId,
      bookTitle: book.title,
      quantity: q,
      unitPrice,
      paymentType: payment,
      totalValue,
    });
    haptics.success();
    router.back();
  };

  const total = book && !isFree && price
    ? (parseInt(qty || "0", 10) * numPrice).toFixed(2)
    : "0.00";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <ChevronLeft size={26} color="#292524" />
        </Pressable>
        <Text className="text-stone-900 text-xl font-extrabold flex-1">Log Sale</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-lg pb-3xl"
        showsVerticalScrollIndicator={false}
      >
        {/* Connectivity status */}
        <View className={`rounded-xl border p-md mb-md flex-row items-center gap-sm ${online ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
          {online ? <Wifi size={16} color="#059669" /> : <WifiOff size={16} color="#d97706" />}
          <Text className={`text-sm flex-1 ${online ? "text-emerald-800" : "text-amber-800"}`}>
            {online
              ? "Online — sale will sync immediately."
              : "Offline — sale will be queued and synced when you reconnect."}
          </Text>
        </View>

        {/* Cached holdings notice */}
        {!online && holdingsCachedAt && (
          <View className="rounded-xl bg-stone-100 border border-stone-200 p-sm mb-md flex-row items-center gap-sm">
            <CloudUpload size={14} color="#78716c" />
            <Text className="text-stone-600 text-xs flex-1">
              Showing cached stock as of{" "}
              {new Date(holdingsCachedAt).toLocaleString("en-IN", {
                day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
              })}
            </Text>
          </View>
        )}

        <Text className="text-stone-600 text-sm font-medium mb-sm">Select Book</Text>
        {loading ? (
          <Skeleton count={3} />
        ) : holdings.length === 0 ? (
          <Text className="text-stone-500 text-sm">You have no stock to sell.</Text>
        ) : (
          <View className="gap-sm">
            {holdings.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => selectBook(h)}
                className={`flex-row items-center rounded-xl border p-md ${book?.id === h.id ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}
              >
                {h.coverUrl ? (
                  <Image source={h.coverUrl} style={{ width: 40, height: 56, borderRadius: 6 }} contentFit="cover" />
                ) : (
                  <View className="w-10 rounded-md bg-stone-100 items-center justify-center" style={{ height: 56 }}>
                    <BookOpen size={18} color="#d6d3d1" />
                  </View>
                )}
                <View className="flex-1 ml-sm">
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
                <TextInput
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="number-pad"
                  className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900"
                />
              </View>
              <View className="flex-1">
                <Text className="text-stone-600 text-sm font-medium mb-xs">Unit Price (₹)</Text>
                <TextInput
                  value={isFree ? "0" : price}
                  editable={!isFree}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  className={`rounded-xl border px-md py-md ${isFree ? "bg-stone-100 border-stone-200 text-stone-400" : "bg-white border-stone-200 text-stone-900"}`}
                />
              </View>
            </View>

            {isDiscounted && !isFree ? (
              <Text className="text-orange-600 text-xs mt-xs">
                Discounted from retail ₹{retail} — recorded as a discounted paid sale.
              </Text>
            ) : null}

            <Text className="text-stone-600 text-sm font-medium mt-lg mb-sm">Payment Type</Text>
            <View className="flex-row flex-wrap gap-sm">
              <Chip label="Cash" active={payment === "cash"} onPress={() => setPayment("cash")} />
              <Chip label="Online" active={payment === "online"} onPress={() => setPayment("online")} />
              <Chip label="Debt" active={payment === "debt"} onPress={() => setPayment("debt")} />
              <Chip
                label="Free / Complimentary"
                active={payment === "free"}
                onPress={() => { setPayment("free"); haptics.selection(); }}
              />
            </View>

            {isFree ? (
              <View className="rounded-xl bg-purple-50 border border-purple-200 p-md mt-md flex-row items-center gap-sm">
                <Gift size={18} color="#7c3aed" />
                <Text className="text-purple-800 text-sm flex-1">
                  Complimentary distribution — reduces stock, ₹0 value, does not affect the outstanding balance.
                </Text>
              </View>
            ) : null}

            <View className="rounded-xl bg-white border border-stone-200 p-md mt-lg flex-row justify-between items-center">
              <Text className="text-stone-500">Total value</Text>
              <Text className="text-stone-900 text-xl font-extrabold">₹{isFree ? "0.00" : total}</Text>
            </View>

            {error ? <Text className="text-rose-600 text-sm mt-sm">{error}</Text> : null}

            <View className="mt-lg">
              <Button
                label={isFree ? "Record Free Distribution" : online ? "Record Sale" : "Queue Sale (Offline)"}
                onPress={submit}
                loading={saving}
              />
            </View>

            {!online && (
              <Text className="text-stone-400 text-xs text-center mt-sm">
                This sale will be stored on your device and synced automatically when you reconnect.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

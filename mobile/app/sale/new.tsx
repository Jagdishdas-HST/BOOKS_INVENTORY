
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ChevronLeft, Check, ScanLine, X, Gift, WifiOff, CloudUpload } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button, Chip, Skeleton } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useOfflineQueue } from "@/lib/offlineQueue";
import { API_URL } from "@/constants/api";

export default function NewSale() {
  const router = useRouter();
  const enqueue = useOfflineQueue((s) => s.enqueue);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState<any>(null);
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [payment, setPayment] = useState<"cash" | "online" | "debt" | "free">("cash");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    authFetch("/api/stock/holdings").then((h) => { setHoldings(h.filter((x: any) => x.quantity > 0)); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const selectBook = (b: any) => { setBook(b); setPrice(String(b.retailPrice)); haptics.selection(); };

  const openScanner = async () => {
    setScanMsg("");
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { setScanMsg("Camera permission denied — use manual select below."); return; }
    }
    setScanning(true);
  };

  const onBarcode = ({ data }: { data: string }) => {
    if (!scanning) return;
    setScanning(false);
    const code = data.trim();
    const match = holdings.find((h) => h.isbn && h.isbn.trim() === code);
    if (match) { selectBook(match); haptics.success(); }
    else { setScanMsg(`No held stock matches barcode ${code}. Select manually.`); haptics.error?.(); }
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

    // Check connectivity first. If offline (or the request fails), queue locally
    // rather than failing the entry.
    let online = false;
    try {
      const h = await fetch(`${API_URL}/health`);
      online = h.ok;
    } catch { online = false; }

    if (online) {
      try {
        await authFetch("/api/sales", {
          method: "POST",
          body: JSON.stringify({ bookId: book.bookId, quantity: q, unitPrice, paymentType: payment }),
        });
        haptics.success();
        router.back();
        return;
      } catch (e: any) {
        // Fall through to queue on network failure; surface hard errors.
        if (e?.message && /₹|only hold|stock|Book/i.test(e.message)) {
          setError(e.message); setSaving(false); return;
        }
        online = false;
      }
    }

    // Offline path: queue locally with a field-time timestamp.
    await enqueue({
      bookId: book.bookId, bookTitle: book.title, quantity: q,
      unitPrice, paymentType: payment, totalValue,
    });
    haptics.success();
    router.back();
  };

  const total = book && !isFree && price ? (parseInt(qty || "0", 10) * numPrice).toFixed(2) : "0.00";

  if (scanning) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-black">
        <StatusBar style="light" />
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"] }} onBarcodeScanned={onBarcode} />
        <View className="absolute top-0 left-0 right-0 flex-row items-center justify-between px-lg pt-md" style={{ paddingTop: 48 }}>
          <Text className="text-white font-semibold">Scan a book barcode</Text>
          <Pressable onPress={() => setScanning(false)} accessibilityLabel="Cancel scan" className="w-10 h-10 rounded-full bg-black/50 items-center justify-center">
            <X size={22} color="#fff" />
          </Pressable>
        </View>
        <View className="absolute inset-0 items-center justify-center pointer-events-none">
          <View className="w-64 h-40 border-2 border-white/80 rounded-xl" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold flex-1">Log Sale</Text>
        <Pressable onPress={openScanner} accessibilityLabel="Scan barcode"
          className="flex-row items-center gap-xs px-md py-sm rounded-full bg-stone-900 active:opacity-80">
          <ScanLine size={16} color="#fff" />
          <Text className="text-white text-sm font-semibold">Scan</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        <View className="rounded-xl bg-sky-50 border border-sky-200 p-md mb-md flex-row items-center gap-sm">
          <WifiOff size={16} color="#0284c7" />
          <Text className="text-sky-800 text-xs flex-1">If you're offline, this sale is queued on your device and synced automatically when you reconnect.</Text>
        </View>

        {scanMsg ? (
          <View className="rounded-xl bg-amber-50 border border-amber-200 p-md mb-md">
            <Text className="text-amber-800 text-sm">{scanMsg}</Text>
          </View>
        ) : null}

        <Text className="text-stone-600 text-sm font-medium mb-sm">Select Book</Text>
        {loading ? <Skeleton count={3} /> : holdings.length === 0 ? (
          <Text className="text-stone-500 text-sm">You have no stock to sell.</Text>
        ) : (
          <View className="gap-sm">
            {holdings.map((h) => (
              <Pressable key={h.id} onPress={() => selectBook(h)}
                className={`flex-row items-center rounded-xl border p-md ${book?.id === h.id ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}>
                {h.coverUrl ? (
                  <Image source={h.coverUrl} style={{ width: 40, height: 56, borderRadius: 6 }} contentFit="cover" />
                ) : (
                  <View className="w-10 rounded-md bg-stone-100 items-center justify-center" style={{ height: 56 }}><Text className="text-stone-300 text-lg">📖</Text></View>
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
                <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad"
                  className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
              </View>
              <View className="flex-1">
                <Text className="text-stone-600 text-sm font-medium mb-xs">Unit Price (₹)</Text>
                <TextInput value={isFree ? "0" : price} editable={!isFree} onChangeText={setPrice} keyboardType="decimal-pad"
                  className={`rounded-xl border px-md py-md ${isFree ? "bg-stone-100 border-stone-200 text-stone-400" : "bg-white border-stone-200 text-stone-900"}`} />
              </View>
            </View>

            {isDiscounted && !isFree ? (
              <Text className="text-orange-600 text-xs mt-xs">Discounted from retail ₹{retail} — recorded as a discounted paid sale.</Text>
            ) : null}

            <Text className="text-stone-600 text-sm font-medium mt-lg mb-sm">Payment Type</Text>
            <View className="flex-row flex-wrap gap-sm">
              <Chip label="Cash" active={payment === "cash"} onPress={() => setPayment("cash")} />
              <Chip label="Online" active={payment === "online"} onPress={() => setPayment("online")} />
              <Chip label="Debt" active={payment === "debt"} onPress={() => setPayment("debt")} />
              <Chip label="Free / Complimentary" active={payment === "free"} onPress={() => { setPayment("free"); haptics.selection(); }} />
            </View>

            {isFree ? (
              <View className="rounded-xl bg-purple-50 border border-purple-200 p-md mt-md flex-row items-center gap-sm">
                <Gift size={18} color="#7c3aed" />
                <Text className="text-purple-800 text-sm flex-1">Complimentary distribution — reduces stock, ₹0 value, does not affect the outstanding balance.</Text>
              </View>
            ) : null}

            <View className="rounded-xl bg-white border border-stone-200 p-md mt-lg flex-row justify-between items-center">
              <Text className="text-stone-500">Total value</Text>
              <Text className="text-stone-900 text-xl font-extrabold">₹{isFree ? "0.00" : total}</Text>
            </View>

            {error ? <Text className="text-rose-600 text-sm mt-sm">{error}</Text> : null}

            <View className="mt-lg">
              <Button label={isFree ? "Record Free Distribution" : "Record Sale"} onPress={submit} loading={saving} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

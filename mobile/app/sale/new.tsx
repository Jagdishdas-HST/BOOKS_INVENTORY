
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import {
  ChevronLeft, Check, Gift, WifiOff, CloudUpload, Wifi, BookOpen,
  User as UserIcon, Building2, Plus, X, Search as SearchIcon, ChevronDown,
} from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button, Chip, Skeleton } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useOfflineQueue } from "@/lib/offlineQueue";
import { useIsOnline, startConnectivityPolling } from "@/lib/connectivity";
import { loadHoldingsCache, type HoldingItem } from "@/lib/offlineCache";

type CustomerLite = {
  id: number;
  name: string;
  type: "institute" | "individual";
  contactPerson: string | null;
};

export default function NewSale() {
  const router = useRouter();
  const params = useLocalSearchParams<{ customerId?: string; customerName?: string }>();
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

  // Customer selection
  const [customerId, setCustomerId] = useState<number | null>(
    params.customerId ? Number(params.customerId) : null,
  );
  const [customerName, setCustomerName] = useState<string | null>(params.customerName ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerLite[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);

  useEffect(() => {
    startConnectivityPolling();
    loadHoldingsCache().then((c) => {
      if (c) {
        setHoldings(c.data.filter((x) => x.quantity > 0));
        setHoldingsCachedAt(c.cachedAt);
        setLoading(false);
      }
    });
    authFetch("/api/stock/holdings")
      .then((h: HoldingItem[]) => {
        setHoldings(h.filter((x) => x.quantity > 0));
        setHoldingsCachedAt(new Date().toISOString());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const openPicker = async () => {
    setPickerOpen(true);
    setCustomerLoading(true);
    try {
      setCustomerResults(await authFetch("/api/customers"));
    } catch {}
    setCustomerLoading(false);
  };

  const searchCustomers = async (t: string) => {
    setCustomerQuery(t);
    setCustomerLoading(true);
    try {
      setCustomerResults(await authFetch(`/api/customers${t.trim() ? `?q=${encodeURIComponent(t.trim())}` : ""}`));
    } catch {}
    setCustomerLoading(false);
  };

  const chooseCustomer = (c: CustomerLite | null) => {
    if (c) {
      setCustomerId(c.id);
      setCustomerName(c.name);
    } else {
      setCustomerId(null);
      setCustomerName(null);
    }
    setPickerOpen(false);
    haptics.selection();
  };

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
            customerId: customerId ?? undefined,
          }),
        });
        haptics.success();
        router.back();
        return;
      } catch (e: any) {
        if (e?.message && /only hold|stock|Book|Customer/i.test(e.message)) {
          setError(e.message);
          setSaving(false);
          return;
        }
      }
    }

    // Offline path (customer link is only stored online, so note it in queue).
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

        {/* Customer selector */}
        <Text className="text-stone-600 text-sm font-medium mb-sm">Customer (optional)</Text>
        {customerId && customerName ? (
          <View className="flex-row items-center rounded-xl bg-amber-50 border border-amber-200 p-md">
            <View className="w-9 h-9 rounded-full bg-amber-100 items-center justify-center">
              <UserIcon size={16} color="#d97706" />
            </View>
            <Text className="text-stone-900 font-semibold flex-1 ml-sm" numberOfLines={1}>{customerName}</Text>
            <Pressable onPress={openPicker} accessibilityLabel="Change customer" className="px-sm py-xs">
              <Text className="text-amber-700 text-sm font-semibold">Change</Text>
            </Pressable>
            <Pressable onPress={() => chooseCustomer(null)} accessibilityLabel="Remove customer" className="pl-sm">
              <X size={18} color="#a8a29e" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={online ? openPicker : undefined}
            accessibilityLabel="Select customer"
            className={`flex-row items-center justify-between rounded-xl border p-md ${online ? "bg-white border-stone-200 active:opacity-80" : "bg-stone-100 border-stone-200"}`}
          >
            <Text className={online ? "text-stone-500" : "text-stone-400"}>
              {online ? "Attach to a customer / institute" : "Customer link needs a connection"}
            </Text>
            <ChevronDown size={18} color="#a8a29e" />
          </Pressable>
        )}

        {/* Cached holdings notice */}
        {!online && holdingsCachedAt && (
          <View className="rounded-xl bg-stone-100 border border-stone-200 p-sm mt-md flex-row items-center gap-sm">
            <CloudUpload size={14} color="#78716c" />
            <Text className="text-stone-600 text-xs flex-1">
              Showing cached stock as of{" "}
              {new Date(holdingsCachedAt).toLocaleString("en-IN", {
                day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
              })}
            </Text>
          </View>
        )}

        <Text className="text-stone-600 text-sm font-medium mb-sm mt-lg">Select Book</Text>
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

      {/* Customer picker modal */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setPickerOpen(false)} />
        <View className="bg-stone-50 rounded-t-3xl px-lg pt-lg" style={{ maxHeight: "80%" }}>
          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-stone-900 text-lg font-extrabold">Select Customer</Text>
            <Pressable onPress={() => setPickerOpen(false)} accessibilityLabel="Close">
              <X size={22} color="#292524" />
            </Pressable>
          </View>

          <View className="flex-row items-center rounded-xl bg-white border border-stone-200 px-md mb-md">
            <SearchIcon size={18} color="#a8a29e" />
            <TextInput
              value={customerQuery}
              onChangeText={searchCustomers}
              placeholder="Search customers…"
              placeholderTextColor="#a8a29e"
              className="flex-1 px-sm py-md text-stone-900"
            />
            {customerLoading && <ActivityIndicator size="small" color="#d97706" />}
          </View>

          <Pressable
            onPress={() => {
              setPickerOpen(false);
              router.push({ pathname: "/customer/new", params: { returnToSale: "1" } });
            }}
            className="flex-row items-center gap-sm rounded-xl bg-amber-600 p-md mb-md active:opacity-80"
          >
            <Plus size={18} color="#fff" />
            <Text className="text-white font-semibold">Add New Customer</Text>
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-3xl">
            <Pressable
              onPress={() => chooseCustomer(null)}
              className="flex-row items-center rounded-xl bg-white border border-stone-200 p-md mb-sm active:opacity-80"
            >
              <View className="w-9 h-9 rounded-full bg-stone-100 items-center justify-center">
                <X size={16} color="#78716c" />
              </View>
              <Text className="text-stone-600 font-medium ml-sm">No customer (walk-in)</Text>
            </Pressable>

            {customerResults.length === 0 && !customerLoading ? (
              <Text className="text-stone-500 text-sm text-center py-lg">No customers found.</Text>
            ) : (
              customerResults.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => chooseCustomer(c)}
                  className="flex-row items-center rounded-xl bg-white border border-stone-200 p-md mb-sm active:opacity-80"
                >
                  <View className={`w-9 h-9 rounded-full items-center justify-center ${c.type === "institute" ? "bg-indigo-100" : "bg-amber-100"}`}>
                    {c.type === "institute"
                      ? <Building2 size={16} color="#4f46e5" />
                      : <UserIcon size={16} color="#d97706" />}
                  </View>
                  <View className="flex-1 ml-sm">
                    <Text className="text-stone-900 font-semibold" numberOfLines={1}>{c.name}</Text>
                    {c.contactPerson ? (
                      <Text className="text-stone-500 text-xs">{c.contactPerson}</Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

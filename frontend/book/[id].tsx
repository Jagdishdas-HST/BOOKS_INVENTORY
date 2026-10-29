
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ChevronLeft, ImagePlus, History, WifiOff } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { uploadImage } from "@/lib/upload";
import { Button, Skeleton } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useIsOnline } from "@/lib/connectivity";

export default function BookDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const online = useIsOnline();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const [retail, setRetail] = useState("");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("");
  const [isbn, setIsbn] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch("/api/books").then((rows) => {
      const b = rows.find((x: any) => String(x.id) === String(id));
      if (b) {
        setBook(b); setTitle(b.title); setCost(String(b.costPrice)); setRetail(String(b.retailPrice));
        setStock(String(b.warehouseStock)); setThreshold(String(b.reorderThreshold ?? 20));
        setIsbn(b.isbn ?? ""); setCoverUrl(b.coverUrl ?? null); setCoverKey(b.coverKey ?? null);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const pickCover = async () => {
    if (!online) { setError("Image upload requires a connection."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (res.canceled) return;
    setUploading(true); setError("");
    try { const up = await uploadImage(res.assets[0]); setCoverUrl(up.url); setCoverKey(up.key); }
    catch (e: any) { setError(e.message); }
    setUploading(false);
  };

  const save = async () => {
    setError("");
    if (!online) { setError("Saving requires a connection."); return; }
    setSaving(true);
    try {
      await authFetch(`/api/books/${id}`, { method: "PATCH", body: JSON.stringify({
        title: title.trim(), costPrice: parseFloat(cost), retailPrice: parseFloat(retail),
        warehouseStock: parseInt(stock || "0", 10), reorderThreshold: parseInt(threshold || "20", 10),
        isbn: isbn.trim() || null, coverUrl, coverKey,
      }) });
      haptics.success();
      router.back();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  const toggleRetire = async () => {
    if (!online) { setError("This action requires a connection."); return; }
    try { await authFetch(`/api/books/${id}`, { method: "PATCH", body: JSON.stringify({ active: !book.active }) }); haptics.medium(); router.back(); } catch (e: any) { setError(e.message); }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Edit Book</Text>
      </View>

      {!online && (
        <View className="mx-lg mb-sm rounded-xl bg-amber-50 border border-amber-200 p-md flex-row items-center gap-sm">
          <WifiOff size={16} color="#d97706" />
          <Text className="text-amber-800 text-sm flex-1">
            Offline — editing and image upload require a connection.
          </Text>
        </View>
      )}

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        {loading ? <Skeleton count={4} /> : !book ? <Text className="text-stone-500">Book not found.</Text> : (
          <>
            <Pressable onPress={pickCover} accessibilityLabel="Change cover"
              className="mb-md h-44 rounded-xl bg-white border border-dashed border-stone-300 items-center justify-center overflow-hidden">
              {uploading ? <ActivityIndicator color="#d97706" /> : coverUrl ? (
                <Image source={coverUrl} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <View className="items-center">
                  <ImagePlus size={28} color="#a8a29e" />
                  <Text className="text-stone-400 text-sm mt-xs">{online ? "Tap to add cover" : "Upload requires connection"}</Text>
                </View>
              )}
            </Pressable>

            <View className="rounded-xl bg-white border border-stone-200 p-md mb-lg">
              <Text className="text-stone-500 text-xs">{book.sku} · {book.category} · {book.language}</Text>
              {book.isbn ? <Text className="text-stone-500 text-xs mt-xs">ISBN {book.isbn}</Text> : null}
            </View>

            <View className="mb-md">
              <Text className="text-stone-600 text-sm font-medium mb-xs">Title</Text>
              <TextInput value={title} onChangeText={setTitle} editable={online} className={`rounded-xl border px-md py-md ${online ? "bg-white border-stone-200 text-stone-900" : "bg-stone-100 border-stone-200 text-stone-500"}`} />
            </View>
            <View className="mb-md">
              <Text className="text-stone-600 text-sm font-medium mb-xs">ISBN / Barcode</Text>
              <TextInput value={isbn} onChangeText={setIsbn} autoCapitalize="none" placeholder="Optional" placeholderTextColor="#a8a29e" editable={online} className={`rounded-xl border px-md py-md ${online ? "bg-white border-stone-200 text-stone-900" : "bg-stone-100 border-stone-200 text-stone-500"}`} />
            </View>
            <View className="flex-row gap-sm">
              <View className="flex-1 mb-md">
                <Text className="text-stone-600 text-sm font-medium mb-xs">Cost (₹)</Text>
                <TextInput value={cost} onChangeText={setCost} keyboardType="decimal-pad" editable={online} className={`rounded-xl border px-md py-md ${online ? "bg-white border-stone-200 text-stone-900" : "bg-stone-100 border-stone-200 text-stone-500"}`} />
              </View>
              <View className="flex-1 mb-md">
                <Text className="text-stone-600 text-sm font-medium mb-xs">Retail (₹)</Text>
                <TextInput value={retail} onChangeText={setRetail} keyboardType="decimal-pad" editable={online} className={`rounded-xl border px-md py-md ${online ? "bg-white border-stone-200 text-stone-900" : "bg-stone-100 border-stone-200 text-stone-500"}`} />
              </View>
            </View>
            <View className="flex-row gap-sm">
              <View className="flex-1 mb-md">
                <Text className="text-stone-600 text-sm font-medium mb-xs">Warehouse stock</Text>
                <TextInput value={stock} onChangeText={setStock} keyboardType="number-pad" editable={online} className={`rounded-xl border px-md py-md ${online ? "bg-white border-stone-200 text-stone-900" : "bg-stone-100 border-stone-200 text-stone-500"}`} />
              </View>
              <View className="flex-1 mb-md">
                <Text className="text-stone-600 text-sm font-medium mb-xs">Reorder threshold</Text>
                <TextInput value={threshold} onChangeText={setThreshold} keyboardType="number-pad" editable={online} className={`rounded-xl border px-md py-md ${online ? "bg-white border-stone-200 text-stone-900" : "bg-stone-100 border-stone-200 text-stone-500"}`} />
              </View>
            </View>

            <Pressable onPress={() => router.push({ pathname: "/book/price-history", params: { id: String(id), title: book.title } })}
              accessibilityLabel="View price history"
              className="flex-row items-center justify-between rounded-xl bg-white border border-stone-200 p-md mb-lg active:opacity-80">
              <View className="flex-row items-center gap-sm">
                <History size={18} color="#b45309" />
                <Text className="text-stone-900 font-medium">Price change history</Text>
              </View>
              <ChevronLeft size={18} color="#a8a29e" style={{ transform: [{ rotate: "180deg" }] }} />
            </Pressable>

            {error ? <Text className="text-rose-600 text-sm mb-sm">{error}</Text> : null}
            {online ? (
              <>
                <Button label="Save Changes" onPress={save} loading={saving} />
                <View className="mt-sm">
                  <Button label={book.active ? "Retire SKU" : "Reactivate SKU"} variant="secondary" onPress={toggleRetire} />
                </View>
              </>
            ) : (
              <View className="rounded-xl bg-stone-100 border border-stone-200 p-md items-center">
                <WifiOff size={20} color="#a8a29e" />
                <Text className="text-stone-500 text-sm mt-xs text-center">Connect to save changes</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

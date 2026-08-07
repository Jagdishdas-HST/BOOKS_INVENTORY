
import { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ChevronLeft, ImagePlus, WifiOff } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { uploadImage } from "@/lib/upload";
import { Button, Chip } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useIsOnline } from "@/lib/connectivity";

const CATEGORIES = ["Bhagavad-gita", "Srimad-Bhagavatam", "Nectar of Devotion", "Small Books", "Magazines", "Other"];

export default function NewBook() {
  const router = useRouter();
  const online = useIsOnline();
  const [sku, setSku] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Bhagavad-gita");
  const [language, setLanguage] = useState("English");
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

  const pickCover = async () => {
    if (!online) {
      setError("Image upload requires a connection.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (res.canceled) return;
    setUploading(true); setError("");
    try {
      const up = await uploadImage(res.assets[0]);
      setCoverUrl(up.url); setCoverKey(up.key);
    } catch (e: any) { setError(e.message); }
    setUploading(false);
  };

  const submit = async () => {
    setError("");
    if (!online) { setError("Adding a book requires a connection."); return; }
    if (!sku.trim() || !title.trim() || !cost || !retail) { setError("Fill SKU, title, cost & retail"); return; }
    setSaving(true);
    try {
      await authFetch("/api/books", { method: "POST", body: JSON.stringify({
        sku: sku.trim(), title: title.trim(), category, language: language.trim() || "English",
        costPrice: parseFloat(cost), retailPrice: parseFloat(retail), warehouseStock: parseInt(stock || "0", 10),
        reorderThreshold: threshold ? parseInt(threshold, 10) : undefined,
        isbn: isbn.trim() || null, coverUrl, coverKey,
      }) });
      haptics.success();
      router.back();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  const field = (label: string, value: string, set: (v: string) => void, kb: any = "default", ph = "") => (
    <View className="mb-md">
      <Text className="text-stone-600 text-sm font-medium mb-xs">{label}</Text>
      <TextInput value={value} onChangeText={set} keyboardType={kb} placeholder={ph} placeholderTextColor="#a8a29e"
        autoCapitalize="none"
        className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Add Book</Text>
      </View>

      {!online && (
        <View className="mx-lg mb-sm rounded-xl bg-amber-50 border border-amber-200 p-md flex-row items-center gap-sm">
          <WifiOff size={16} color="#d97706" />
          <Text className="text-amber-800 text-sm flex-1">
            Adding books requires a connection. Reconnect and try again.
          </Text>
        </View>
      )}

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        <Text className="text-stone-600 text-sm font-medium mb-sm">Cover Image</Text>
        <Pressable onPress={pickCover} accessibilityLabel="Upload cover"
          className={`mb-md h-40 rounded-xl border border-dashed items-center justify-center overflow-hidden ${online ? "bg-white border-stone-300" : "bg-stone-100 border-stone-200"}`}>
          {uploading ? <ActivityIndicator color="#d97706" /> : coverUrl ? (
            <Image source={coverUrl} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <View className="items-center">
              {online ? <ImagePlus size={28} color="#a8a29e" /> : <WifiOff size={28} color="#a8a29e" />}
              <Text className="text-stone-400 text-sm mt-xs">{online ? "Tap to add cover" : "Upload requires connection"}</Text>
            </View>
          )}
        </Pressable>

        {field("SKU", sku, setSku, "default", "BG-EN-001")}
        {field("Title", title, setTitle, "default", "Bhagavad-gita As It Is")}
        {field("ISBN / Barcode (optional)", isbn, setIsbn, "default", "9789383095001")}

        <Text className="text-stone-600 text-sm font-medium mb-sm">Category</Text>
        <View className="py-xs mb-md">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm">
            {CATEGORIES.map((c) => <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />)}
          </ScrollView>
        </View>

        {field("Language", language, setLanguage, "default", "English")}
        <View className="flex-row gap-sm">
          <View className="flex-1">{field("Cost (₹)", cost, setCost, "decimal-pad", "120")}</View>
          <View className="flex-1">{field("Retail (₹)", retail, setRetail, "decimal-pad", "350")}</View>
        </View>
        <View className="flex-row gap-sm">
          <View className="flex-1">{field("Initial warehouse stock", stock, setStock, "number-pad", "200")}</View>
          <View className="flex-1">{field("Reorder threshold", threshold, setThreshold, "number-pad", "20")}</View>
        </View>

        {error ? <Text className="text-rose-600 text-sm mb-sm">{error}</Text> : null}
        <Button label="Add to Catalog" onPress={submit} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

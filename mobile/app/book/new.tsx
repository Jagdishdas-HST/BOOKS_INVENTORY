
import { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button, Chip } from "@/components/ui";
import { haptics } from "@/lib/haptics";

const CATEGORIES = ["Bhagavad-gita", "Srimad-Bhagavatam", "Nectar of Devotion", "Small Books", "Magazines", "Other"];

export default function NewBook() {
  const router = useRouter();
  const [sku, setSku] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Bhagavad-gita");
  const [language, setLanguage] = useState("English");
  const [cost, setCost] = useState("");
  const [retail, setRetail] = useState("");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (!sku.trim() || !title.trim() || !cost || !retail) { setError("Fill SKU, title, cost & retail"); return; }
    setSaving(true);
    try {
      await authFetch("/api/books", { method: "POST", body: JSON.stringify({
        sku: sku.trim(), title: title.trim(), category, language: language.trim() || "English",
        costPrice: parseFloat(cost), retailPrice: parseFloat(retail),
        warehouseStock: parseInt(stock || "0", 10),
        reorderThreshold: threshold.trim() ? parseInt(threshold, 10) : 10,
      }) });
      haptics.success();
      router.back();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  const field = (label: string, value: string, set: (v: string) => void, kb: any = "default", ph = "") => (
    <View className="mb-md">
      <Text className="text-stone-600 text-sm font-medium mb-xs">{label}</Text>
      <TextInput value={value} onChangeText={set} keyboardType={kb} placeholder={ph} placeholderTextColor="#a8a29e"
        autoCapitalize={kb === "default" ? "none" : "none"}
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

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        {field("SKU", sku, setSku, "default", "BG-EN-001")}
        {field("Title", title, setTitle, "default", "Bhagavad-gita As It Is")}

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
          <View className="flex-1">{field("Reorder at ≤ (optional)", threshold, setThreshold, "number-pad", "10")}</View>
        </View>

        {error ? <Text className="text-rose-600 text-sm mb-sm">{error}</Text> : null}
        <Button label="Add to Catalog" onPress={submit} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

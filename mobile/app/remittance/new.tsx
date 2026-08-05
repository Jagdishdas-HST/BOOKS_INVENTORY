
import { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button } from "@/components/ui";
import { haptics } from "@/lib/haptics";

export default function NewRemittance() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    const a = parseFloat(amount);
    if (!a || a <= 0) { setError("Enter a valid amount"); return; }
    setSaving(true);
    try {
      await authFetch("/api/remittances", { method: "POST", body: JSON.stringify({ amount: a, note: note.trim() || null }) });
      haptics.success();
      router.back();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Log Remittance</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        <Text className="text-stone-500 text-sm mb-lg">Record a payment you handed in to reduce your outstanding balance.</Text>
        <Text className="text-stone-600 text-sm font-medium mb-xs">Amount (₹)</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="5000" placeholderTextColor="#a8a29e"
          className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900 text-lg" />

        <Text className="text-stone-600 text-sm font-medium mt-lg mb-xs">Note / Reference (optional)</Text>
        <TextInput value={note} onChangeText={setNote} placeholder="Partial payment, cash deposit ref #123" placeholderTextColor="#a8a29e"
          className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />

        {error ? <Text className="text-rose-600 text-sm mt-sm">{error}</Text> : null}

        <View className="mt-lg">
          <Button label="Record Payment" onPress={submit} loading={saving} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

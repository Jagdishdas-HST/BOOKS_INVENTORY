
import { useState, useEffect } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, WifiOff } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { useIsOnline, startConnectivityPolling } from "@/lib/connectivity";

export default function NewRemittance() {
  const router = useRouter();
  const online = useIsOnline();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    startConnectivityPolling();
  }, []);

  const submit = async () => {
    setError("");
    if (!online) {
      setError("Remittances require a connection. Reconnect and try again.");
      return;
    }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await authFetch("/api/remittances", {
        method: "POST",
        body: JSON.stringify({ amount: amt, note: note.trim() || null }),
      });
      haptics.success();
      router.back();
    } catch (e: any) {
      setError(e.message || "Failed to log remittance");
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <ChevronLeft size={26} color="#292524" />
        </Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Log Remittance</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        {!online && (
          <View className="rounded-xl bg-amber-50 border border-amber-200 p-md mb-lg flex-row items-center gap-sm">
            <WifiOff size={16} color="#d97706" />
            <Text className="text-amber-800 text-sm flex-1">
              Remittances require a connection. Reconnect to log a payment.
            </Text>
          </View>
        )}

        <View className="mb-md">
          <Text className="text-stone-600 text-sm font-medium mb-xs">Amount (₹)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="500"
            placeholderTextColor="#a8a29e"
            editable={online}
            className={`rounded-xl border px-md py-md ${online ? "bg-white border-stone-200 text-stone-900" : "bg-stone-100 border-stone-200 text-stone-500"}`}
          />
        </View>

        <View className="mb-lg">
          <Text className="text-stone-600 text-sm font-medium mb-xs">Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Cash handover at temple"
            placeholderTextColor="#a8a29e"
            multiline
            numberOfLines={3}
            editable={online}
            className={`rounded-xl border px-md py-md ${online ? "bg-white border-stone-200 text-stone-900" : "bg-stone-100 border-stone-200 text-stone-500"}`}
            style={{ textAlignVertical: "top", minHeight: 80 }}
          />
        </View>

        {error ? (
          <View className="rounded-xl bg-rose-50 border border-rose-200 p-md mb-md">
            <Text className="text-rose-700 text-sm">{error}</Text>
          </View>
        ) : null}

        <Button
          label={online ? "Log Remittance" : "No Connection"}
          onPress={submit}
          loading={saving}
        />

        {!online && (
          <Text className="text-stone-400 text-xs text-center mt-sm">
            Unlike sales, remittances cannot be queued offline — they require a live connection to update your balance.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

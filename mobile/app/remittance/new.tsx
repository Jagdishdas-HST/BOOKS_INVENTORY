
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Check, Layers, Wand2 } from "lucide-react-native";
import { format } from "date-fns";
import { authFetch, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui";
import { haptics } from "@/lib/haptics";

export default function NewRemittance() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  // If an admin arrives with ?distributorId=&name=, they log on behalf of that
  // distributor and may allocate. Distributors log their own (flat balance only).
  const params = useLocalSearchParams<{ distributorId?: string; name?: string }>();
  const isAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";
  const targetDistId = params.distributorId ? Number(params.distributorId) : user?.id;

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [allocate, setAllocate] = useState(false);
  const [openDebts, setOpenDebts] = useState<any[]>([]);
  // Map of saleId -> allocated amount string.
  const [alloc, setAlloc] = useState<Record<number, string>>({});

  const canAllocate = isAdmin && !!params.distributorId;

  useEffect(() => {
    if (canAllocate) {
      authFetch(`/api/sales/debt-open?distributorId=${targetDistId}`).then(setOpenDebts).catch(() => {});
    }
  }, [canAllocate]);

  const applyFifo = () => {
    const amt = parseFloat(amount || "0");
    if (!amt || amt <= 0) { setError("Enter the amount first, then FIFO."); return; }
    let remaining = amt;
    const next: Record<number, string> = {};
    for (const d of openDebts) {
      if (remaining <= 0.005) break;
      const take = Math.min(remaining, d.remaining);
      next[d.id] = take.toFixed(2);
      remaining -= take;
    }
    setAlloc(next);
    haptics.selection();
  };

  const allocSum = Object.values(alloc).reduce((a, v) => a + (parseFloat(v) || 0), 0);

  const submit = async () => {
    setError("");
    const a = parseFloat(amount);
    if (!a || a <= 0) { setError("Enter a valid amount"); return; }

    const body: any = { amount: a, note: note.trim() || null };
    if (canAllocate) body.distributorId = targetDistId;
    if (canAllocate && allocate) {
      const allocations = Object.entries(alloc)
        .map(([saleId, v]) => ({ saleId: Number(saleId), amount: parseFloat(v) || 0 }))
        .filter((x) => x.amount > 0);
      if (allocations.length === 0) { setError("Add at least one allocation, or turn off allocation."); return; }
      if (allocSum - a > 0.005) { setError("Allocations exceed the payment amount."); return; }
      body.allocations = allocations;
    }

    setSaving(true);
    try {
      await authFetch("/api/remittances", { method: "POST", body: JSON.stringify(body) });
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
        <Text className="text-stone-500 text-sm mb-lg">
          {canAllocate ? `Recording a payment for ${params.name || "distributor"}.` : "Record a payment you handed in to reduce your outstanding balance."}
        </Text>
        <Text className="text-stone-600 text-sm font-medium mb-xs">Amount (₹)</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="5000" placeholderTextColor="#a8a29e"
          className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900 text-lg" />

        <Text className="text-stone-600 text-sm font-medium mt-lg mb-xs">Note / Reference (optional)</Text>
        <TextInput value={note} onChangeText={setNote} placeholder="Partial payment, cash deposit ref #123" placeholderTextColor="#a8a29e"
          className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />

        {canAllocate ? (
          <>
            <Pressable onPress={() => { setAllocate((v) => !v); haptics.selection(); }}
              accessibilityLabel="Toggle allocation"
              className="flex-row items-center justify-between rounded-xl bg-white border border-stone-200 p-md mt-lg">
              <View className="flex-row items-center gap-sm flex-1 pr-sm">
                <Layers size={18} color="#d97706" />
                <View className="flex-1">
                  <Text className="text-stone-900 font-semibold">Allocate to specific debt sales</Text>
                  <Text className="text-stone-500 text-xs">Optional — otherwise this just reduces the running total.</Text>
                </View>
              </View>
              <View className={`w-6 h-6 rounded-md items-center justify-center border ${allocate ? "bg-amber-600 border-amber-600" : "border-stone-300"}`}>
                {allocate && <Check size={16} color="#fff" />}
              </View>
            </Pressable>

            {allocate ? (
              <View className="mt-md">
                <View className="flex-row items-center justify-between mb-sm">
                  <Text className="text-stone-600 text-sm font-medium">Open debt sales (oldest first)</Text>
                  <Pressable onPress={applyFifo} accessibilityLabel="Auto-fill FIFO"
                    className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-amber-100 active:opacity-80">
                    <Wand2 size={14} color="#b45309" />
                    <Text className="text-amber-700 text-xs font-semibold">FIFO suggest</Text>
                  </Pressable>
                </View>
                {openDebts.length === 0 ? (
                  <Text className="text-stone-500 text-sm">No open debt sales to allocate against.</Text>
                ) : (
                  <View className="gap-sm">
                    {openDebts.map((d) => (
                      <View key={d.id} className="rounded-xl bg-white border border-stone-200 p-md">
                        <View className="flex-row justify-between">
                          <Text className="text-stone-900 font-semibold flex-1 pr-sm" numberOfLines={1}>{d.bookTitle}</Text>
                          <Text className="text-stone-500 text-xs">{format(new Date(d.createdAt), "d MMM")}</Text>
                        </View>
                        <Text className="text-stone-500 text-xs mt-xs">Remaining ₹{d.remaining.toFixed(2)} of ₹{d.totalValue.toFixed(2)}</Text>
                        <View className="flex-row items-center gap-sm mt-sm">
                          <Text className="text-stone-500 text-xs">Allocate ₹</Text>
                          <TextInput
                            value={alloc[d.id] || ""}
                            onChangeText={(t) => setAlloc((prev) => ({ ...prev, [d.id]: t }))}
                            keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#a8a29e"
                            className="flex-1 rounded-lg bg-stone-50 border border-stone-200 px-sm py-xs text-stone-900" />
                        </View>
                      </View>
                    ))}
                    <View className="rounded-xl bg-stone-100 p-md flex-row justify-between">
                      <Text className="text-stone-600 text-sm">Allocated</Text>
                      <Text className={`font-bold ${allocSum - (parseFloat(amount) || 0) > 0.005 ? "text-rose-600" : "text-stone-900"}`}>₹{allocSum.toFixed(2)}</Text>
                    </View>
                  </View>
                )}
              </View>
            ) : null}
          </>
        ) : null}

        {error ? <Text className="text-rose-600 text-sm mt-sm">{error}</Text> : null}

        <View className="mt-lg">
          <Button label="Record Payment" onPress={submit} loading={saving} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

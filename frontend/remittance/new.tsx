
import { useState, useEffect } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, HandCoins, Check } from "lucide-react-native";
import { authFetch, useAuth } from "@/lib/auth";
import { Button, Skeleton } from "@/components/ui";
import { haptics } from "@/lib/haptics";

export default function NewRemittance() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const params = useLocalSearchParams<{ distributorId?: string; name?: string }>();

  const isAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";
  const targetDistId = params.distributorId ? Number(params.distributorId) : null;
  const targetName = params.name || user?.name || "You";

  const [distributors, setDistributors] = useState<any[]>([]);
  const [selectedDist, setSelectedDist] = useState<any>(null);
  const [loadingDists, setLoadingDists] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAdmin && !targetDistId) {
      setLoadingDists(true);
      authFetch("/api/users/distributors")
        .then((d) => { setDistributors(d.filter((x: any) => x.active)); setLoadingDists(false); })
        .catch(() => setLoadingDists(false));
    }
  }, [isAdmin, targetDistId]);

  const submit = async () => {
    setError("");
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount greater than 0");
      return;
    }

    let distId: number | null = null;
    if (user?.role === "distributor") {
      distId = user.id;
    } else if (targetDistId) {
      distId = targetDistId;
    } else if (selectedDist) {
      distId = selectedDist.id;
    } else {
      setError("Select a distributor");
      return;
    }

    setSaving(true);
    try {
      const body: any = { amount: amt, note: note.trim() || null };
      if (isAdmin) body.distributorId = distId;

      await authFetch("/api/remittances", {
        method: "POST",
        body: JSON.stringify(body),
      });
      haptics.success();
      router.back();
    } catch (e: any) {
      setError(e.message || "Failed to record remittance");
      setSaving(false);
    }
  };

  const displayName = user?.role === "distributor"
    ? user.name
    : targetDistId
    ? targetName
    : selectedDist?.name || "Select distributor";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <ChevronLeft size={26} color="#292524" />
        </Pressable>
        <Text className="text-stone-900 text-xl font-extrabold flex-1">Log Remittance</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-lg pb-3xl"
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View className="flex-row items-center gap-sm rounded-xl bg-emerald-50 border border-emerald-200 p-md mb-lg">
          <HandCoins size={20} color="#059669" />
          <Text className="text-emerald-800 text-sm flex-1">
            Record a cash or bank payment to reduce the outstanding balance.
          </Text>
        </View>

        {/* Distributor selector — only for admin when no pre-selected distributor */}
        {isAdmin && !targetDistId && (
          <>
            <Text className="text-stone-600 text-sm font-medium mb-sm">Distributor</Text>
            {loadingDists ? (
              <Skeleton count={3} />
            ) : (
              <View className="gap-sm mb-lg">
                {distributors.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => { setSelectedDist(d); haptics.selection(); }}
                    className={`flex-row items-center justify-between rounded-xl border p-md ${selectedDist?.id === d.id ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}
                  >
                    <View className="flex-row items-center gap-sm flex-1">
                      <View className="w-9 h-9 rounded-full bg-stone-100 items-center justify-center">
                        <Text className="text-stone-700 font-bold">{d.name[0]}</Text>
                      </View>
                      <Text className="text-stone-900 font-semibold">{d.name}</Text>
                    </View>
                    {selectedDist?.id === d.id && <Check size={18} color="#d97706" />}
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        {/* Show selected distributor when pre-selected */}
        {(user?.role === "distributor" || targetDistId) && (
          <View className="rounded-xl bg-white border border-stone-200 p-md mb-lg flex-row items-center gap-sm">
            <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center">
              <Text className="text-amber-700 font-bold text-base">{displayName[0]}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-stone-900 font-semibold">{displayName}</Text>
              <Text className="text-stone-500 text-xs">Remittance will be credited to this account</Text>
            </View>
          </View>
        )}

        {/* Amount */}
        <View className="mb-md">
          <Text className="text-stone-600 text-sm font-medium mb-xs">{"Amount (\u20b9)"}</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="e.g. 5000"
            placeholderTextColor="#a8a29e"
            className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900 text-xl font-bold"
          />
        </View>

        {/* Note */}
        <View className="mb-lg">
          <Text className="text-stone-600 text-sm font-medium mb-xs">Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Weekly cash handover, NEFT transfer"
            placeholderTextColor="#a8a29e"
            multiline
            className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900 min-h-[70px]"
          />
        </View>

        {error ? (
          <Text className="text-rose-600 text-sm mb-sm">{error}</Text>
        ) : null}

        <Button label="Record Payment" onPress={submit} loading={saving} />

        <Text className="text-stone-400 text-xs text-center mt-sm">
          This payment is recorded in the audit log and reduces the outstanding balance immediately.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

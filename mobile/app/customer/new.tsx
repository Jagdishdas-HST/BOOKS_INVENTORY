
import { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Building2, User as UserIcon } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button } from "@/components/ui";
import { haptics } from "@/lib/haptics";

export default function NewCustomer() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToSale?: string }>();
  const [type, setType] = useState<"institute" | "individual">("individual");
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (!name.trim()) { setError("Enter a name"); return; }
    setSaving(true);
    try {
      const created = await authFetch("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          type,
          contactPerson: contactPerson.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          note: note.trim() || null,
        }),
      });
      haptics.success();
      if (params.returnToSale) {
        // Return to the sale screen with this customer pre-selected.
        router.replace({
          pathname: "/sale/new",
          params: { customerId: String(created.id), customerName: created.name },
        });
      } else {
        router.replace({ pathname: "/customer/[id]", params: { id: String(created.id) } });
      }
    } catch (e: any) {
      setError(e?.message || "Could not save");
      setSaving(false);
    }
  };

  const TypeChip = ({ value, label, icon }: { value: "institute" | "individual"; label: string; icon: React.ReactNode }) => (
    <Pressable
      onPress={() => { setType(value); haptics.selection(); }}
      className={`flex-1 flex-row items-center justify-center gap-xs rounded-xl border py-md ${type === value ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}
    >
      {icon}
      <Text className={type === value ? "text-amber-800 font-semibold" : "text-stone-600 font-medium"}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold flex-1">Add Customer</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text className="text-stone-600 text-sm font-medium mb-sm">Customer Type</Text>
        <View className="flex-row gap-sm">
          <TypeChip value="individual" label="Individual" icon={<UserIcon size={16} color={type === "individual" ? "#d97706" : "#78716c"} />} />
          <TypeChip value="institute" label="Institute" icon={<Building2 size={16} color={type === "institute" ? "#d97706" : "#78716c"} />} />
        </View>

        <Text className="text-stone-600 text-sm font-medium mt-lg mb-xs">
          {type === "institute" ? "Institute Name" : "Full Name"}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={type === "institute" ? "e.g. City Public Library" : "e.g. Ramesh Kumar"}
          placeholderTextColor="#a8a29e"
          className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900"
        />

        {type === "institute" && (
          <>
            <Text className="text-stone-600 text-sm font-medium mt-lg mb-xs">Contact Person</Text>
            <TextInput
              value={contactPerson}
              onChangeText={setContactPerson}
              placeholder="e.g. Librarian name"
              placeholderTextColor="#a8a29e"
              className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900"
            />
          </>
        )}

        <Text className="text-stone-600 text-sm font-medium mt-lg mb-xs">Phone</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="Optional"
          placeholderTextColor="#a8a29e"
          className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900"
        />

        <Text className="text-stone-600 text-sm font-medium mt-lg mb-xs">Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="Optional"
          placeholderTextColor="#a8a29e"
          className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900"
        />

        <Text className="text-stone-600 text-sm font-medium mt-lg mb-xs">Address</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Optional"
          placeholderTextColor="#a8a29e"
          multiline
          className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900"
          style={{ minHeight: 64, textAlignVertical: "top" }}
        />

        <Text className="text-stone-600 text-sm font-medium mt-lg mb-xs">Note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Regular monthly buyer"
          placeholderTextColor="#a8a29e"
          multiline
          className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900"
          style={{ minHeight: 64, textAlignVertical: "top" }}
        />

        {error ? <Text className="text-rose-600 text-sm mt-sm">{error}</Text> : null}

        <View className="mt-lg">
          <Button label="Save Customer" onPress={submit} loading={saving} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

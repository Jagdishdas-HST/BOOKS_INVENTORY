
import { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button, Chip } from "@/components/ui";
import { haptics } from "@/lib/haptics";

export default function NewUser() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"inventory_manager" | "distributor">("distributor");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (!name.trim() || !username.trim() || password.length < 4) { setError("Name, username & 4+ char password required"); return; }
    setSaving(true);
    try {
      await authFetch("/api/users", { method: "POST", body: JSON.stringify({ name: name.trim(), username: username.trim(), password, role }) });
      haptics.success();
      router.back();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-lg pt-md pb-sm gap-sm">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><ChevronLeft size={26} color="#292524" /></Pressable>
        <Text className="text-stone-900 text-xl font-extrabold">Create User</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-lg pb-3xl" showsVerticalScrollIndicator={false}>
        <View className="mb-md">
          <Text className="text-stone-600 text-sm font-medium mb-xs">Full Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Nitai Chand" placeholderTextColor="#a8a29e"
            className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
        </View>
        <View className="mb-md">
          <Text className="text-stone-600 text-sm font-medium mb-xs">Username</Text>
          <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="nitai" placeholderTextColor="#a8a29e"
            className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
        </View>
        <View className="mb-md">
          <Text className="text-stone-600 text-sm font-medium mb-xs">Password</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="min 4 chars" placeholderTextColor="#a8a29e"
            className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
        </View>

        <Text className="text-stone-600 text-sm font-medium mb-sm">Role</Text>
        <View className="flex-row gap-sm">
          <Chip label="Distributor" active={role === "distributor"} onPress={() => setRole("distributor")} />
          <Chip label="Inventory Manager" active={role === "inventory_manager"} onPress={() => setRole("inventory_manager")} />
        </View>

        {error ? <Text className="text-rose-600 text-sm mt-md">{error}</Text> : null}
        <View className="mt-lg">
          <Button label="Create Account" onPress={submit} loading={saving} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

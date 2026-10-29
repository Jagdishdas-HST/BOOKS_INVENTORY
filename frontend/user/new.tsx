
import { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, Check, Eye, EyeOff } from "lucide-react-native";
import { authFetch } from "@/lib/auth";
import { Button, Chip } from "@/components/ui";
import { haptics } from "@/lib/haptics";

const ROLES = [
  { key: "distributor", label: "Distributor", hint: "Can log sales, view holdings & remittances" },
  { key: "inventory_manager", label: "Inventory Manager", hint: "Can manage stock, books & assignments" },
  { key: "super_admin", label: "Super Admin", hint: "Full access including audit log" },
] as const;

export default function NewUser() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"distributor" | "inventory_manager" | "super_admin">("distributor");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (!name.trim()) { setError("Enter the user's full name"); return; }
    if (!username.trim() || username.trim().length < 2) { setError("Username must be at least 2 characters"); return; }
    if (!password || password.length < 4) { setError("Password must be at least 4 characters"); return; }

    setSaving(true);
    try {
      await authFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          password,
          role,
        }),
      });
      haptics.success();
      router.back();
    } catch (e: any) {
      setError(e.message || "Failed to create user");
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
        <Text className="text-stone-900 text-xl font-extrabold">Create User Account</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-lg pb-3xl"
        showsVerticalScrollIndicator={false}
      >
        {/* Full name */}
        <View className="mb-md">
          <Text className="text-stone-600 text-sm font-medium mb-xs">Full Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Arjuna Das"
            placeholderTextColor="#a8a29e"
            className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900"
          />
        </View>

        {/* Username */}
        <View className="mb-md">
          <Text className="text-stone-600 text-sm font-medium mb-xs">Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. arjuna"
            placeholderTextColor="#a8a29e"
            className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900"
          />
          <Text className="text-stone-400 text-xs mt-xs">Lowercase only · used to sign in</Text>
        </View>

        {/* Password */}
        <View className="mb-lg">
          <Text className="text-stone-600 text-sm font-medium mb-xs">Password</Text>
          <View className="flex-row items-center rounded-xl bg-white border border-stone-200 px-md">
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="Min. 4 characters"
              placeholderTextColor="#a8a29e"
              className="flex-1 py-md text-stone-900"
            />
            <Pressable onPress={() => setShowPassword(v => !v)} accessibilityLabel="Toggle password visibility">
              {showPassword
                ? <EyeOff size={16} color="#a8a29e" />
                : <Eye size={16} color="#a8a29e" />}
            </Pressable>
          </View>
        </View>

        {/* Role */}
        <Text className="text-stone-600 text-sm font-medium mb-sm">Role</Text>
        <View className="gap-sm mb-lg">
          {ROLES.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => { setRole(r.key); haptics.selection(); }}
              className={`flex-row items-center justify-between rounded-xl border p-md ${role === r.key ? "border-amber-600 bg-amber-50" : "border-stone-200 bg-white"}`}
            >
              <View className="flex-1 pr-sm">
                <Text className="text-stone-900 font-semibold">{r.label}</Text>
                <Text className="text-stone-500 text-xs mt-xs">{r.hint}</Text>
              </View>
              {role === r.key && <Check size={18} color="#d97706" />}
            </Pressable>
          ))}
        </View>

        {error ? (
          <Text className="text-rose-600 text-sm mb-sm">{error}</Text>
        ) : null}

        <Button label="Create Account" onPress={submit} loading={saving} />

        <Text className="text-stone-400 text-xs text-center mt-sm">
          The new account will be active immediately. The user can sign in with the credentials above.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

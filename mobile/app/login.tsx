
import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { BookOpen, Eye, EyeOff } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const hydrate = useAuth((s) => s.hydrate);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!hydrated) hydrate(); }, [hydrated]);
  useEffect(() => { if (user) router.replace("/(tabs)"); }, [user]);

  const submit = async () => {
    setError(""); setLoading(true);
    try { await login(username.trim(), password); router.replace("/(tabs)"); }
    catch (e: any) { setError(e.message || "Login failed"); }
    setLoading(false);
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <View className="flex-1 justify-center px-xl">
        <View className="items-center mb-2xl">
          <View className="w-16 h-16 rounded-2xl bg-amber-600 items-center justify-center mb-md">
            <BookOpen size={30} color="#fff" />
          </View>
          <Text className="text-stone-900 text-2xl font-extrabold">BBT Ledger</Text>
          <Text className="text-stone-500 text-sm mt-xs">Book Inventory & Distribution</Text>
        </View>

        <View className="gap-md">
          <View>
            <Text className="text-stone-600 text-sm font-medium mb-xs">Username</Text>
            <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false}
              placeholder="admin" placeholderTextColor="#a8a29e"
              className="rounded-xl bg-white border border-stone-200 px-md py-md text-stone-900" />
          </View>
          <View>
            <Text className="text-stone-600 text-sm font-medium mb-xs">Password</Text>
            <View className="flex-row items-center rounded-xl bg-white border border-stone-200 px-md">
              <TextInput value={password} onChangeText={setPassword} secureTextEntry={!show}
                placeholder="••••••" placeholderTextColor="#a8a29e"
                className="flex-1 py-md text-stone-900" />
              <Pressable onPress={() => setShow(!show)} accessibilityLabel="Toggle password">
                {show ? <EyeOff size={18} color="#a8a29e" /> : <Eye size={18} color="#a8a29e" />}
              </Pressable>
            </View>
          </View>

          {error ? <Text className="text-rose-600 text-sm">{error}</Text> : null}

          <View className="mt-sm">
            <Button label="Sign In" onPress={submit} loading={loading} />
          </View>

          <View className="rounded-xl bg-amber-50 border border-amber-200 p-md mt-sm">
            <Text className="text-amber-800 text-xs font-semibold mb-xs">Demo accounts</Text>
            <Text className="text-amber-700 text-xs">admin / admin123 · manager / manager123 · nitai / nitai123</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

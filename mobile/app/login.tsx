
import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { BookOpen, WifiOff, Lock, User } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { useIsOnline, startConnectivityPolling } from "@/lib/connectivity";
import { haptics } from "@/lib/haptics";

export default function Login() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const needsReauth = useAuth((s) => s.needsReauth);
  const online = useIsOnline();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingReauth, setCheckingReauth] = useState(true);

  useEffect(() => {
    startConnectivityPolling();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      hydrate();
      return;
    }
    // If already logged in, check if re-auth is needed.
    if (user) {
      needsReauth().then((needs) => {
        if (!needs) {
          // Still within the re-auth window — go straight to the app.
          router.replace("/(tabs)");
        } else {
          // Re-auth timeout exceeded — must log in again.
          setCheckingReauth(false);
        }
      });
    } else {
      setCheckingReauth(false);
    }
  }, [hydrated, user]);

  const submit = async () => {
    setError("");
    if (!username.trim()) { setError("Enter your username"); return; }
    if (!password) { setError("Enter your password"); return; }
    if (!online) {
      setError("You're offline. Connect to the internet to sign in.");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      haptics.success();
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Login failed");
      haptics.error?.();
    }
    setLoading(false);
  };

  if (!hydrated || checkingReauth) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50 items-center justify-center">
        <StatusBar style="dark" />
        <View className="w-12 h-12 rounded-full bg-amber-100 items-center justify-center">
          <BookOpen size={24} color="#d97706" />
        </View>
        <Text className="text-stone-400 text-sm mt-md">Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-1 justify-center px-lg pb-3xl"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Offline banner */}
          {!online && (
            <View className="rounded-xl bg-amber-50 border border-amber-200 p-md mb-lg flex-row items-center gap-sm">
              <WifiOff size={18} color="#d97706" />
              <View className="flex-1">
                <Text className="text-amber-800 font-semibold text-sm">You're offline</Text>
                <Text className="text-amber-700 text-xs mt-xs">
                  Sign-in requires a connection. If you were already signed in, reopen the app — you'll stay logged in for up to 30 days without signal.
                </Text>
              </View>
            </View>
          )}

          {/* Logo */}
          <View className="items-center mb-2xl">
            <View className="w-20 h-20 rounded-2xl bg-amber-600 items-center justify-center mb-md shadow-sm">
              <BookOpen size={40} color="#fff" />
            </View>
            <Text className="text-stone-900 text-3xl font-extrabold">Inventory Tracker</Text>
            <Text className="text-stone-500 text-sm mt-xs">Field Sales · Distribution</Text>
          </View>

          {/* Form */}
          <View className="gap-md">
            <View>
              <Text className="text-stone-600 text-sm font-medium mb-xs">Username</Text>
              <View className="flex-row items-center rounded-xl bg-white border border-stone-200 px-md">
                <User size={18} color="#a8a29e" />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="your.username"
                  placeholderTextColor="#a8a29e"
                  className="flex-1 px-sm py-md text-stone-900"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View>
              <Text className="text-stone-600 text-sm font-medium mb-xs">Password</Text>
              <View className="flex-row items-center rounded-xl bg-white border border-stone-200 px-md">
                <Lock size={18} color="#a8a29e" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor="#a8a29e"
                  className="flex-1 px-sm py-md text-stone-900"
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />
              </View>
            </View>

            {error ? (
              <View className="rounded-xl bg-rose-50 border border-rose-200 p-md">
                <Text className="text-rose-700 text-sm">{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={loading || !online}
              accessibilityLabel="Sign in"
              className={`rounded-xl py-md items-center ${loading || !online ? "bg-stone-300" : "bg-amber-600 active:opacity-80"}`}
            >
              <Text className={`font-bold text-base ${loading || !online ? "text-stone-500" : "text-white"}`}>
                {loading ? "Signing in…" : "Sign In"}
              </Text>
            </Pressable>
          </View>

          <Text className="text-stone-400 text-xs text-center mt-xl px-lg">
            Your session stays active for 30 days. After that, you'll need to sign in again even if offline.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

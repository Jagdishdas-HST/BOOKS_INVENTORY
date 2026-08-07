
import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  BackHandler,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Eye, EyeOff, X, ArrowLeft, Shield, Users, ChevronRight, LogIn } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/constants/api";

const DEMO_ACCOUNTS = [
  { role: "Super Admin", username: "admin", password: "admin123", color: "#7c3aed", bg: "#ede9fe" },
  { role: "Manager", username: "manager", password: "manager123", color: "#0891b2", bg: "#cffafe" },
  { role: "Distributor 1", username: "dist1", password: "dist123", color: "#059669", bg: "#d1fae5" },
  { role: "Distributor 2", username: "dist2", password: "dist123", color: "#d97706", bg: "#fef3c7" },
  { role: "Distributor 3", username: "dist3", password: "dist123", color: "#dc2626", bg: "#fee2e2" },
];

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    if (!showDemo) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setShowDemo(false);
      return true;
    });
    return () => sub.remove();
  }, [showDemo]);

  async function handleLogin(u?: string, p?: string) {
    const user = u ?? username.trim();
    const pass = p ?? password;
    if (!user || !pass) {
      setError("Please enter username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Invalid credentials.");
        return;
      }
      await AsyncStorage.setItem("auth_token", data.token);
      await AsyncStorage.setItem("auth_user", JSON.stringify(data.user));
      router.replace("/(tabs)");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function fillAndLogin(acc: (typeof DEMO_ACCOUNTS)[0]) {
    setShowDemo(false);
    setUsername(acc.username);
    setPassword(acc.password);
    handleLogin(acc.username, acc.password);
  }

  function fillOnly(acc: (typeof DEMO_ACCOUNTS)[0]) {
    setUsername(acc.username);
    setPassword(acc.password);
    setShowDemo(false);
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-slate-50">
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pt-16 pb-12"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Header */}
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-violet-600 items-center justify-center mb-4">
              <Shield size={32} color="#fff" />
            </View>
            <Text className="text-slate-900 text-3xl font-bold">Inventory Tracker</Text>
            <Text className="text-slate-500 text-sm mt-1">Sign in to your account</Text>
          </View>

          {/* Form */}
          <View className="bg-white rounded-2xl border border-slate-200 p-6 gap-4">
            <View>
              <Text className="text-slate-700 text-sm font-semibold mb-1.5">Username</Text>
              <TextInput
                value={username}
                onChangeText={(t) => { setUsername(t); setError(""); }}
                placeholder="Enter username"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-base"
              />
            </View>

            <View>
              <Text className="text-slate-700 text-sm font-semibold mb-1.5">Password</Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4">
                <TextInput
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(""); }}
                  placeholder="Enter password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  className="flex-1 py-3 text-slate-900 text-base"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityLabel="Toggle password visibility">
                  {showPassword
                    ? <EyeOff size={18} color="#94a3b8" />
                    : <Eye size={18} color="#94a3b8" />}
                </Pressable>
              </View>
            </View>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <Text className="text-red-600 text-sm">{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => handleLogin()}
              disabled={loading}
              accessibilityLabel="Sign in"
              className="bg-violet-600 rounded-xl py-3.5 items-center active:opacity-80"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center gap-2">
                  <LogIn size={18} color="#fff" />
                  <Text className="text-white font-bold text-base">Sign In</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Demo accounts banner */}
          <Pressable
            onPress={() => setShowDemo(true)}
            accessibilityLabel="View demo accounts"
            className="mt-5 flex-row items-center justify-between bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 active:opacity-80"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-full bg-violet-100 items-center justify-center">
                <Users size={18} color="#7c3aed" />
              </View>
              <View>
                <Text className="text-violet-800 font-semibold text-sm">Try Demo Accounts</Text>
                <Text className="text-violet-500 text-xs mt-0.5">5 pre-loaded accounts available</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#7c3aed" />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Demo Accounts Modal */}
      <Modal
        visible={showDemo}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDemo(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl">
            <SafeAreaView edges={["bottom"]}>
              {/* Header */}
              <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
                <Pressable
                  onPress={() => setShowDemo(false)}
                  accessibilityLabel="Go back"
                  className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:opacity-70"
                >
                  <ArrowLeft size={18} color="#0f172a" />
                </Pressable>
                <Text className="text-slate-900 text-base font-bold">Demo Accounts</Text>
                <Pressable
                  onPress={() => setShowDemo(false)}
                  accessibilityLabel="Close demo accounts"
                  className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:opacity-70"
                >
                  <X size={18} color="#0f172a" />
                </Pressable>
              </View>

              <ScrollView
                className="max-h-96"
                contentContainerClassName="px-5 py-4 gap-3"
                showsVerticalScrollIndicator={false}
              >
                {DEMO_ACCOUNTS.map((acc) => (
                  <View
                    key={acc.username}
                    className="border border-slate-200 rounded-2xl overflow-hidden"
                  >
                    <View className="px-4 py-3 flex-row items-center justify-between" style={{ backgroundColor: acc.bg }}>
                      <Text style={{ color: acc.color }} className="font-bold text-sm">{acc.role}</Text>
                    </View>
                    <View className="px-4 py-3 bg-white">
                      <View className="flex-row gap-4 mb-3">
                        <View className="flex-1">
                          <Text className="text-slate-400 text-xs mb-0.5">Username</Text>
                          <Text className="text-slate-900 font-semibold text-sm">{acc.username}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-slate-400 text-xs mb-0.5">Password</Text>
                          <Text className="text-slate-900 font-semibold text-sm">{acc.password}</Text>
                        </View>
                      </View>
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() => fillOnly(acc)}
                          accessibilityLabel={`Fill form with ${acc.role} credentials`}
                          className="flex-1 border border-slate-200 rounded-xl py-2 items-center active:opacity-70"
                        >
                          <Text className="text-slate-700 text-sm font-semibold">Fill Form</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => fillAndLogin(acc)}
                          accessibilityLabel={`Quick sign in as ${acc.role}`}
                          className="flex-1 rounded-xl py-2 items-center active:opacity-80"
                          style={{ backgroundColor: acc.color }}
                        >
                          <Text className="text-white text-sm font-semibold">Quick Sign In</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View className="px-5 pb-4 pt-2">
                <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <Text className="text-amber-700 text-xs text-center">
                    Every action is critically logged with actor name, ID, and timestamp in the Audit Log.
                  </Text>
                </View>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

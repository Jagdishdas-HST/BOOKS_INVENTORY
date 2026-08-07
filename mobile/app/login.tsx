
import { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ScrollView, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  BookOpen, WifiOff, Lock, User, ChevronRight,
  Shield, Package, Users, X, Eye, EyeOff, Zap,
} from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { useIsOnline, startConnectivityPolling } from "@/lib/connectivity";
import { haptics } from "@/lib/haptics";

const DEMO_ACCOUNTS = [
  {
    label: "Super Admin",
    name: "Gopal Das",
    username: "admin",
    password: "admin123",
    description: "Full access · Audit log · All reports",
    icon: Shield,
    iconColor: "#d97706",
    iconBg: "bg-amber-100",
    badgeBg: "bg-amber-500",
    badgeText: "ADMIN",
  },
  {
    label: "Inventory Manager",
    name: "Radha Priya",
    username: "manager",
    password: "manager123",
    description: "Stock · Books · Assignments",
    icon: Package,
    iconColor: "#2563eb",
    iconBg: "bg-blue-100",
    badgeBg: "bg-blue-500",
    badgeText: "MANAGER",
  },
  {
    label: "Distributor — Nitai Chand",
    name: "Nitai Chand",
    username: "nitai",
    password: "nitai123",
    description: "Sales · Holdings · Remittances",
    icon: Users,
    iconColor: "#059669",
    iconBg: "bg-emerald-100",
    badgeBg: "bg-emerald-500",
    badgeText: "DIST",
  },
  {
    label: "Distributor — Vraja Kishor",
    name: "Vraja Kishor",
    username: "vraja",
    password: "vraja123",
    description: "Sales · Holdings · Remittances",
    icon: Users,
    iconColor: "#7c3aed",
    iconBg: "bg-violet-100",
    badgeBg: "bg-violet-500",
    badgeText: "DIST",
  },
  {
    label: "Distributor — Madhava Dasa",
    name: "Madhava Dasa",
    username: "madhava",
    password: "madhava123",
    description: "Sales · Holdings · Remittances",
    icon: Users,
    iconColor: "#0891b2",
    iconBg: "bg-cyan-100",
    badgeBg: "bg-cyan-500",
    badgeText: "DIST",
  },
];

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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingReauth, setCheckingReauth] = useState(true);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [quickLogging, setQuickLogging] = useState<string | null>(null);

  useEffect(() => {
    startConnectivityPolling();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      hydrate();
      return;
    }
    if (user) {
      needsReauth().then((needs) => {
        if (!needs) {
          router.replace("/(tabs)");
        } else {
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

  const quickLogin = async (acc: typeof DEMO_ACCOUNTS[0]) => {
    setError("");
    if (!online) {
      setError("You're offline. Connect to sign in.");
      setShowDemoModal(false);
      return;
    }
    setQuickLogging(acc.username);
    try {
      await login(acc.username, acc.password);
      haptics.success();
      setShowDemoModal(false);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Login failed");
      haptics.error?.();
    }
    setQuickLogging(null);
  };

  const fillCredentials = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setUsername(acc.username);
    setPassword(acc.password);
    setShowDemoModal(false);
    setError("");
  };

  if (!hydrated || checkingReauth) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50 items-center justify-center">
        <StatusBar style="dark" />
        <View className="w-16 h-16 rounded-2xl bg-amber-600 items-center justify-center">
          <BookOpen size={32} color="#fff" />
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
            <View className="rounded-2xl bg-amber-50 border border-amber-200 p-md mb-lg flex-row items-center gap-sm">
              <WifiOff size={18} color="#d97706" />
              <View className="flex-1">
                <Text className="text-amber-800 font-semibold text-sm">You're offline</Text>
                <Text className="text-amber-700 text-xs mt-xs">
                  Sign-in requires a connection. Reopen the app if you were already signed in.
                </Text>
              </View>
            </View>
          )}

          {/* Logo + branding */}
          <View className="items-center mb-2xl">
            <View
              className="w-24 h-24 rounded-3xl bg-amber-600 items-center justify-center mb-md"
              style={{ shadowColor: "#d97706", shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}
            >
              <BookOpen size={44} color="#fff" />
            </View>
            <Text className="text-stone-900 text-3xl font-extrabold tracking-tight">Inventory Tracker</Text>
            <Text className="text-stone-500 text-sm mt-xs">Field Sales · Distribution · Audit</Text>
          </View>

          {/* Demo accounts banner */}
          <Pressable
            onPress={() => setShowDemoModal(true)}
            accessibilityLabel="View demo accounts"
            className="rounded-2xl bg-amber-50 border border-amber-200 p-md mb-lg flex-row items-center gap-sm active:opacity-80"
            style={{ shadowColor: "#d97706", shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }}
          >
            <View className="w-10 h-10 rounded-xl bg-amber-500 items-center justify-center">
              <Zap size={20} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-amber-900 font-bold text-sm">Try Demo Accounts</Text>
              <Text className="text-amber-700 text-xs mt-xs">
                5 pre-loaded accounts · Admin, Manager, 3 Distributors
              </Text>
            </View>
            <ChevronRight size={18} color="#d97706" />
          </Pressable>

          {/* Login form */}
          <View
            className="bg-white rounded-3xl border border-stone-100 p-lg gap-md"
            style={{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
          >
            <Text className="text-stone-900 text-lg font-extrabold mb-xs">Sign In</Text>

            {/* Username */}
            <View>
              <Text className="text-stone-500 text-xs font-semibold uppercase tracking-wider mb-xs">Username</Text>
              <View className="flex-row items-center rounded-xl bg-stone-50 border border-stone-200 px-md">
                <User size={18} color="#a8a29e" />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="your.username"
                  placeholderTextColor="#a8a29e"
                  className="flex-1 px-sm py-md text-stone-900 text-base"
                  returnKeyType="next"
                />
                {username.length > 0 && (
                  <Pressable onPress={() => setUsername("")} accessibilityLabel="Clear username">
                    <X size={14} color="#a8a29e" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Password */}
            <View>
              <Text className="text-stone-500 text-xs font-semibold uppercase tracking-wider mb-xs">Password</Text>
              <View className="flex-row items-center rounded-xl bg-stone-50 border border-stone-200 px-md">
                <Lock size={18} color="#a8a29e" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#a8a29e"
                  className="flex-1 px-sm py-md text-stone-900 text-base"
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />
                <Pressable onPress={() => setShowPassword(v => !v)} accessibilityLabel="Toggle password visibility">
                  {showPassword
                    ? <EyeOff size={16} color="#a8a29e" />
                    : <Eye size={16} color="#a8a29e" />}
                </Pressable>
              </View>
            </View>

            {/* Error */}
            {error ? (
              <View className="rounded-xl bg-rose-50 border border-rose-200 p-md flex-row items-center gap-sm">
                <X size={16} color="#f43f5e" />
                <Text className="text-rose-700 text-sm flex-1">{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <Pressable
              onPress={submit}
              disabled={loading || !online}
              accessibilityLabel="Sign in"
              className={`rounded-2xl py-md items-center ${loading || !online ? "bg-stone-200" : "bg-amber-600 active:opacity-80"}`}
              style={loading || !online ? {} : { shadowColor: "#d97706", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
            >
              <Text className={`font-bold text-base ${loading || !online ? "text-stone-400" : "text-white"}`}>
                {loading ? "Signing in…" : "Sign In"}
              </Text>
            </Pressable>
          </View>

          <Text className="text-stone-400 text-xs text-center mt-xl px-lg">
            Sessions stay active for 30 days. After that, sign in again even if offline.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Demo Accounts Modal */}
      <Modal
        visible={showDemoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDemoModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowDemoModal(false)}
        >
          <Pressable onPress={e => e.stopPropagation()} className="bg-white rounded-t-3xl">
            {/* Handle */}
            <View className="items-center pt-md pb-sm">
              <View className="w-10 h-1 rounded-full bg-stone-200" />
            </View>

            <ScrollView
              className="px-lg"
              contentContainerClassName="pb-3xl"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between mb-lg">
                <View>
                  <Text className="text-stone-900 text-xl font-extrabold">Demo Accounts</Text>
                  <Text className="text-stone-500 text-xs mt-xs">Tap to sign in instantly · or fill credentials</Text>
                </View>
                <Pressable
                  onPress={() => setShowDemoModal(false)}
                  accessibilityLabel="Close"
                  className="w-9 h-9 rounded-full bg-stone-100 items-center justify-center"
                >
                  <X size={18} color="#78716c" />
                </Pressable>
              </View>

              {/* Account cards */}
              <View className="gap-sm">
                {DEMO_ACCOUNTS.map((acc) => {
                  const Icon = acc.icon;
                  const isLoading = quickLogging === acc.username;
                  return (
                    <View
                      key={acc.username}
                      className="rounded-2xl bg-stone-50 border border-stone-100 overflow-hidden"
                      style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
                    >
                      {/* Account info row */}
                      <View className="flex-row items-center p-md gap-sm">
                        <View className={`w-12 h-12 rounded-2xl ${acc.iconBg} items-center justify-center`}>
                          <Icon size={22} color={acc.iconColor} />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center gap-xs mb-xs">
                            <Text className="text-stone-900 font-bold text-sm">{acc.name}</Text>
                            <View className={`rounded-full px-2 py-0.5 ${acc.badgeBg}`}>
                              <Text className="text-white text-[9px] font-extrabold tracking-wider">{acc.badgeText}</Text>
                            </View>
                          </View>
                          <Text className="text-stone-500 text-xs">{acc.description}</Text>
                          <View className="flex-row items-center gap-md mt-xs">
                            <View className="flex-row items-center gap-xs">
                              <Text className="text-stone-400 text-[10px] font-semibold uppercase tracking-wide">User</Text>
                              <Text className="text-stone-700 text-xs font-mono font-bold">{acc.username}</Text>
                            </View>
                            <View className="flex-row items-center gap-xs">
                              <Text className="text-stone-400 text-[10px] font-semibold uppercase tracking-wide">Pass</Text>
                              <Text className="text-stone-700 text-xs font-mono font-bold">{acc.password}</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Action buttons */}
                      <View className="flex-row border-t border-stone-100">
                        <Pressable
                          onPress={() => fillCredentials(acc)}
                          accessibilityLabel={`Fill credentials for ${acc.name}`}
                          className="flex-1 py-sm items-center border-r border-stone-100 active:bg-stone-100"
                        >
                          <Text className="text-stone-600 text-xs font-semibold">Fill Form</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => quickLogin(acc)}
                          disabled={isLoading || !online}
                          accessibilityLabel={`Quick sign in as ${acc.name}`}
                          className={`flex-1 py-sm items-center flex-row justify-center gap-xs ${isLoading || !online ? "opacity-50" : "active:opacity-70"}`}
                        >
                          <Zap size={12} color={acc.iconColor} />
                          <Text className="text-xs font-bold" style={{ color: acc.iconColor }}>
                            {isLoading ? "Signing in…" : "Quick Sign In"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Audit note */}
              <View className="mt-lg rounded-2xl bg-amber-50 border border-amber-100 p-md flex-row items-start gap-sm">
                <Shield size={16} color="#d97706" />
                <View className="flex-1">
                  <Text className="text-amber-800 font-bold text-xs">Critical Audit Logging Active</Text>
                  <Text className="text-amber-700 text-xs mt-xs leading-4">
                    Every login, sale, stock movement, price change, and remittance is recorded with the actor's name, ID, entity ID, and exact timestamp. Visible to Super Admin only under the Audit Log.
                  </Text>
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

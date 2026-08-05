
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { LogOut, UserPlus, Users, ChevronRight, ShieldCheck } from "lucide-react-native";
import { useAuth, authFetch, roleLabel } from "@/lib/auth";
import { Button, Skeleton } from "@/components/ui";

export default function Profile() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "super_admin";
  const isManagerOrAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";

  const load = useCallback(async () => {
    if (!isManagerOrAdmin) { setLoading(false); return; }
    try { setUsers(await authFetch("/api/users")); } catch {}
    setLoading(false);
  }, [isManagerOrAdmin]);
  useEffect(() => { load(); }, [load]);

  if (!user) return null;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-stone-50">
      <StatusBar style="dark" />
      <ScrollView className="flex-1" contentContainerClassName="pb-3xl" showsVerticalScrollIndicator={false}>
        <View className="items-center pt-lg pb-md">
          <View className="w-20 h-20 rounded-full bg-amber-600 items-center justify-center">
            <Text className="text-white text-2xl font-extrabold">{user.name[0]}</Text>
          </View>
          <Text className="text-stone-900 text-xl font-extrabold mt-sm">{user.name}</Text>
          <View className="flex-row items-center gap-xs mt-xs">
            <ShieldCheck size={14} color="#d97706" />
            <Text className="text-amber-700 text-sm font-semibold">{roleLabel[user.role]}</Text>
          </View>
        </View>

        {isAdmin && (
          <View className="px-lg mt-md">
            <Pressable onPress={() => router.push("/user/new")} accessibilityLabel="Create user"
              className="flex-row items-center gap-sm rounded-xl bg-amber-600 p-md active:opacity-80">
              <UserPlus size={18} color="#fff" />
              <Text className="text-white font-semibold flex-1">Create User Account</Text>
              <ChevronRight size={18} color="#fed7aa" />
            </Pressable>
          </View>
        )}

        {isManagerOrAdmin && (
          <View className="px-lg mt-xl">
            <View className="flex-row items-center gap-xs mb-sm">
              <Users size={18} color="#292524" />
              <Text className="text-stone-900 text-lg font-bold">Team Members</Text>
            </View>
            {loading ? <Skeleton /> : (
              <View className="gap-sm">
                {users.map((u) => (
                  <View key={u.id} className="flex-row items-center rounded-xl bg-white border border-stone-200 p-md">
                    <View className="w-9 h-9 rounded-full bg-stone-100 items-center justify-center mr-sm">
                      <Text className="text-stone-700 font-bold">{u.name[0]}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-stone-900 font-semibold">{u.name}</Text>
                      <Text className="text-stone-500 text-xs">{roleLabel[u.role as keyof typeof roleLabel]}{!u.active ? " · inactive" : ""}</Text>
                    </View>
                    {isAdmin && u.id !== user.id && (
                      <Pressable onPress={async () => {
                        try { await authFetch(`/api/users/${u.id}/active`, { method: "PATCH", body: JSON.stringify({ active: !u.active }) }); load(); } catch {}
                      }} accessibilityLabel={u.active ? "Deactivate" : "Activate"}
                        className={`rounded-full px-md py-xs ${u.active ? "bg-rose-100" : "bg-emerald-100"}`}>
                        <Text className={`text-xs font-semibold ${u.active ? "text-rose-700" : "text-emerald-700"}`}>{u.active ? "Deactivate" : "Activate"}</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View className="px-lg mt-2xl">
          <Button label="Sign Out" variant="danger" onPress={async () => { await logout(); router.replace("/login"); }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

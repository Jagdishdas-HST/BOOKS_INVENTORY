
import { Tabs } from "expo-router";
import { LayoutDashboard, BookOpen, Boxes, Receipt, User } from "lucide-react-native";
import { useAuth } from "@/lib/auth";

export default function TabsLayout() {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "super_admin" || user?.role === "inventory_manager";
  const isDistributor = user?.role === "distributor";

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#d97706", tabBarInactiveTintColor: "#a8a29e", tabBarStyle: { backgroundColor: "#fff", borderTopColor: "#e7e5e4" } }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} /> }} />
      <Tabs.Screen name="catalog" options={{ title: "Catalog", href: isAdmin ? undefined : null, tabBarIcon: ({ color }) => <BookOpen size={22} color={color} /> }} />
      <Tabs.Screen name="stock" options={{ title: "Stock", href: isAdmin ? undefined : null, tabBarIcon: ({ color }) => <Boxes size={22} color={color} /> }} />
      <Tabs.Screen name="ledger" options={{ title: "Ledger", href: isDistributor ? undefined : null, tabBarIcon: ({ color }) => <Receipt size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <User size={22} color={color} /> }} />
    </Tabs>
  );
}


import { Tabs } from "expo-router";
import { Home, BookOpen, Boxes, Receipt, Users, User } from "lucide-react-native";
import { useAuth } from "@/lib/auth";

export default function TabsLayout() {
  const user = useAuth((s) => s.user);
  const isDistributor = user?.role === "distributor";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#d97706",
        tabBarInactiveTintColor: "#a8a29e",
        tabBarStyle: { backgroundColor: "#ffffff", borderTopColor: "#e7e5e4" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <Home size={22} color={color} /> }} />
      <Tabs.Screen name="catalog" options={{ title: "Catalog", tabBarIcon: ({ color }) => <BookOpen size={22} color={color} /> }} />
      <Tabs.Screen name="stock" options={{ title: "Stock", tabBarIcon: ({ color }) => <Boxes size={22} color={color} /> }} />
      <Tabs.Screen
        name="ledger"
        options={{
          title: "Ledger",
          tabBarIcon: ({ color }) => <Receipt size={22} color={color} />,
          // Ledger is distributor-focused; hide the tab bar entry for non-distributors.
          href: isDistributor ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: "Customers",
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
          // Customers belong to distributors' own book delivery records.
          href: isDistributor ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <User size={22} color={color} /> }} />
    </Tabs>
  );
}

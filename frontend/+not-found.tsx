// app/+not-found.tsx
//
// Expo Router renders this whenever no route file matches the requested path. Without it
// the user hits the bare "Unmatched Route — Page could not be found" screen with no way
// back, which is a dead end for a mistyped <Link>, a deleted screen, or a deep link that
// arrives before its route exists.
//
// The guard matters: app/index.tsx redirects to /(tabs), and group segments are
// transparent in the URL, so a missing (tabs) group resolves to pathname "/" and lands
// back here. Redirecting home in that state would loop forever, so "/" renders a plain
// fallback instead.

import { Redirect, usePathname } from "expo-router";
import { Text, View } from "react-native";

export default function NotFound() {
  const pathname = usePathname();

  if (pathname !== "/") return <Redirect href="/" />;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 6 }}>Screen not found</Text>
      <Text style={{ fontSize: 13, opacity: 0.6, textAlign: "center" }}>
        This route does not exist yet.
      </Text>
    </View>
  );
}

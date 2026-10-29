// app/auth-callback.tsx
//
// Deep-link landing route for social login. Under Expo Go the provider sends the
// browser back to exp://<tunnel-host>/--/auth-callback?token=<jwt>, and Expo Router
// matches that path against a REAL FILE under app/ — independently of whether
// WebBrowser.openAuthSessionAsync's promise resolved. Without this file every login
// lands on the "Unmatched Route" screen even though the token exchange succeeded.
//
// Shipped in the seed so the route always exists. The AI may overwrite this file with
// its own version; what must never happen is the file being absent.

import { useEffect, useState } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AuthCallback() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Cold-start path: the OS opened the app via the deep link, so openAuthSessionAsync's
    // promise never resolved and this query param is the only copy of the token. Persist it
    // under the same key the app reads on boot; the warm path just rewrites the same value.
    (async () => {
      try {
        if (typeof token === "string" && token.length > 0) {
          await AsyncStorage.setItem("authToken", token);
        }
      } catch {
        // Never block the redirect on a storage failure — a stuck callback screen is worse
        // than a login the user can simply retry.
      }
      if (!cancelled) setHandled(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!handled) return null;
  return <Redirect href="/" />;
}

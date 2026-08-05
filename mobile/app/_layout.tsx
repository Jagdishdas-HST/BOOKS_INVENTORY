// app/_layout.tsx
//
// Root layout. Owns infrastructure ONLY:
//   - JoyloErrorBoundary  (catches runtime errors + posts them to the host
//                          iframe for the self-heal CTA — DO NOT remove)
//   - KeyboardProvider    (react-native-keyboard-controller — keyboard avoidance)
//   - SafeAreaProvider    (notch / home-indicator awareness)
//   - Inter font loading  (renders null until fonts are loaded)
//
// Theming is intentionally LEFT TO THE AI. No ThemeProvider, no palette
// system, no CSS variables. AI uses raw Tailwind classes (e.g. bg-zinc-900,
// text-emerald-500). The app is LOCKED to ONE mode via app.json's
// `userInterfaceStyle` — never use the `dark:` prefix or `useColorScheme()`
// (both crash on SDK 54 + Hermes).

import { useEffect } from "react";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider, initialWindowMetrics, SafeAreaFrameContext, SafeAreaInsetsContext } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { JoyloErrorBoundary, useJoyloErrorHandlers } from "@/components/JoyloErrorBoundary";
import { useAppFonts } from "@/lib/fonts";
import "../global.css";

SplashScreen.preventAutoHideAsync().catch(() => {});

const isIframe = typeof window !== "undefined" && window.self !== window.top;

// Web-iframe safe-area values. The MobilePreview phone-mockup overlays a
// Dynamic Island + Status Bar at the top (≈ 47px) and a home-indicator area
// at the bottom (≈ 34px). The iframe spans the FULL phone screen area, so
// these insets are the only mechanism that pushes AI content clear of those
// overlays. AI's <SafeAreaView edges={["top","bottom"]}> reads these via
// `useSafeAreaInsets()` and reserves the right amount. Values match the
// actual iPhone 14/15 Pro insets so screens designed with normal
// SafeAreaView render natively-correct in the iframe.
// Web-iframe safe-area values. AI's <SafeAreaView edges={["top","bottom"]}>
// reads these via `useSafeAreaInsets()`. Kept just large enough to clear the
// Dynamic Island / Status Bar / home-indicator overlays in the MobilePreview
// phone mockup — NOT the full iPhone-spec 47/34 (which doubled up with the
// MobilePreview wrapper padding and ate too much vertical space).
const webInsets = {
  frame: { x: 0, y: 0, width: 380, height: 780 },
  insets: { top: 35, left: 0, right: 0, bottom: 20 }
};

export default function RootLayout() {
  useJoyloErrorHandlers();
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <JoyloErrorBoundary>
      <KeyboardProvider>
        {isIframe ? (
          <SafeAreaFrameContext.Provider value={webInsets.frame}>
            <SafeAreaInsetsContext.Provider value={webInsets.insets}>
              <Slot />
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        ) : (
          <SafeAreaProvider initialMetrics={initialWindowMetrics ?? undefined}>
            <Slot />
          </SafeAreaProvider>
        )}
      </KeyboardProvider>
    </JoyloErrorBoundary>
  );
}

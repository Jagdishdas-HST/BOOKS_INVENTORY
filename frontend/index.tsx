// app/index.tsx
//
// Root route — redirects to the (tabs) group. Every Joylo mobile app uses
// tab navigation as the primary nav pattern, so the root just bounces into
// /(tabs) which resolves to app/(tabs)/index.tsx (the first tab screen).
//
// If your app does NOT use a tabs group (rare — single-stack apps), overwrite
// THIS file with your landing screen content instead of a Redirect.

import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/(tabs)" />;
}

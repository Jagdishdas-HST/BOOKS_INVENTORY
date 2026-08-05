import {
  useFonts as useExpoFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";

export const FONT_MAP = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} as const;

/**
 * useAppFonts — loads Inter weights used by the design system.
 * Safe to call before fonts load; returns false until loaded.
 */
export function useAppFonts(): boolean {
  const [loaded] = useExpoFonts(FONT_MAP);
  return loaded;
}

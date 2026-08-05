import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Haptic feedback presets. On Web (expo-web preview) these are no-ops.
 *
 * Convention:
 *   - light  → every Pressable / Button tap
 *   - medium → confirmations, toggle state
 *   - heavy  → drag-end, important navigation
 *   - success / warning / error → result of an action
 *   - selection → list-item picker (date wheel, segmented control)
 */
function safe(fn: () => Promise<unknown>) {
  if (Platform.OS === "web") return;
  fn().catch(() => {});
}

export const haptics = {
  light:     () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium:    () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy:     () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success:   () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning:   () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error:     () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  selection: () => safe(() => Haptics.selectionAsync()),
};

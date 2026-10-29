import { Platform } from "react-native";

function safe(fn: () => Promise<unknown>) {
  if (Platform.OS === "web") return;
  fn().catch(() => {});
}

export const haptics = {
  light:     () => safe(async () => {}),
  medium:    () => safe(async () => {}),
  heavy:     () => safe(async () => {}),
  success:   () => safe(async () => {}),
  warning:   () => safe(async () => {}),
  error:     () => safe(async () => {}),
  selection: () => safe(async () => {}),
};
import { Platform, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/constants/api";

export async function downloadExport(path: string) {
  const token = await AsyncStorage.getItem("authToken");
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API_URL}${path}${sep}token=${encodeURIComponent(token ?? "")}`;

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
      return;
    }
  }
  try {
    await Linking.openURL(url);
  } catch {
    await Linking.openURL(url);
  }
}
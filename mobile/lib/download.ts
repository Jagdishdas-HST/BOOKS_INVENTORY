
import { Platform, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "@/constants/api";

/**
 * Trigger a browser download / file open for an authenticated export endpoint.
 * The backend export routes accept the JWT via ?token= (browser navigation
 * can't set the Authorization header).
 *
 * @param path e.g. "/api/reports/export/sales.csv?range=week"
 */
export async function downloadExport(path: string) {
  const token = await AsyncStorage.getItem("authToken");
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API_URL}${path}${sep}token=${encodeURIComponent(token ?? "")}`;

  if (Platform.OS === "web") {
    // Open in a new tab — the Content-Disposition header triggers the download.
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
      return;
    }
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url);
  }
}

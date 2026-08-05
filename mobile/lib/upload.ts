
import { Platform } from "react-native";
import { API_URL } from "@/constants/api";
import { getToken } from "@/lib/auth";

export type Uploaded = { url: string; key: string };

// Uploads an image asset to S3 via the backend and returns { url, key }.
export async function uploadImage(asset: { uri: string; fileName?: string | null; mimeType?: string | null }, folder = "covers"): Promise<Uploaded> {
  const name = asset.fileName ?? `cover-${Date.now()}.${asset.uri.split(".").pop() || "jpg"}`;
  const type = asset.mimeType ?? "image/jpeg";
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(asset.uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri: asset.uri, name, type } as any);
  }
  const token = await getToken();
  const res = await fetch(`${API_URL}/api/upload?folder=${folder}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data?.url) throw new Error(data?.error || "Upload failed");
  return { url: data.url, key: data.key };
}

import { Pressable, Text } from "react-native";
import { Download, WifiOff } from "lucide-react-native";
import { downloadExport } from "@/lib/download";
import { useIsOnline } from "@/lib/connectivity";

export function ExportButton({ path, label = "Export CSV" }: { path: string; label?: string }) {
  const online = useIsOnline();

  if (!online) {
    return (
      <Pressable
        accessibilityLabel={`${label} — requires connection`}
        className="flex-row items-center gap-xs px-md py-sm rounded-full bg-stone-200"
        disabled
      >
        <WifiOff size={13} color="#a8a29e" />
        <Text className="text-stone-400 text-sm font-semibold">{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityLabel={label}
      onPress={() => downloadExport(path)}
      className="flex-row items-center gap-xs px-md py-sm rounded-full bg-stone-900 active:opacity-80"
    >
      <Download size={15} color="#fff" />
      <Text className="text-white text-sm font-semibold">{label}</Text>
    </Pressable>
  );
}
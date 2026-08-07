
import { Pressable, Text } from "react-native";
import { Download, WifiOff } from "lucide-react-native";
import { haptics } from "@/lib/haptics";
import { downloadExport } from "@/lib/download";
import { useIsOnline } from "@/lib/connectivity";

/**
 * Small pill button that exports the given backend CSV endpoint.
 * Disabled with a clear "no connection" state when offline.
 */
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
      onPress={() => { haptics.selection(); downloadExport(path); }}
      className="flex-row items-center gap-xs px-md py-sm rounded-full bg-stone-900 active:opacity-80"
    >
      <Download size={15} color="#fff" />
      <Text className="text-white text-sm font-semibold">{label}</Text>
    </Pressable>
  );
}

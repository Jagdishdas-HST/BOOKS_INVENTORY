
import { Pressable, Text } from "react-native";
import { Download } from "lucide-react-native";
import { haptics } from "@/lib/haptics";
import { downloadExport } from "@/lib/download";

/**
 * Small pill button that exports the given backend CSV endpoint (with the
 * current filters already baked into `path`) to the browser as a download.
 */
export function ExportButton({ path, label = "Export CSV" }: { path: string; label?: string }) {
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

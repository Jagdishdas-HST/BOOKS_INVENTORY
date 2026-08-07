
import { View, Text } from "react-native";
import { WifiOff, Clock } from "lucide-react-native";
import { useIsOnline } from "@/lib/connectivity";
import { formatCacheTime } from "@/lib/offlineCache";

interface Props {
  cachedAt?: string | null;
  label?: string;
}

/**
 * Shows a prominent amber banner when offline, with an optional "as of [time]"
 * label so users never mistake cached data for live data.
 */
export function OfflineBanner({ cachedAt, label }: Props) {
  const online = useIsOnline();
  if (online) return null;

  return (
    <View className="mx-lg mb-md rounded-xl bg-amber-50 border border-amber-300 p-md">
      <View className="flex-row items-center gap-sm">
        <WifiOff size={16} color="#d97706" />
        <Text className="text-amber-800 font-semibold text-sm flex-1">
          {label ?? "Offline — showing cached data"}
        </Text>
      </View>
      {cachedAt ? (
        <View className="flex-row items-center gap-xs mt-xs">
          <Clock size={12} color="#b45309" />
          <Text className="text-amber-700 text-xs">
            as of {formatCacheTime(cachedAt)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Inline "no connection" notice for actions that require connectivity.
 */
export function ConnectivityRequired({ action }: { action: string }) {
  const online = useIsOnline();
  if (online) return null;
  return (
    <View className="rounded-xl bg-stone-100 border border-stone-200 p-md flex-row items-center gap-sm">
      <WifiOff size={16} color="#78716c" />
      <Text className="text-stone-600 text-sm flex-1">
        {action} requires a connection. Reconnect and try again.
      </Text>
    </View>
  );
}

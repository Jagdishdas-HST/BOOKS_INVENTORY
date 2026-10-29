import React from "react";
import { Platform, View, Text, StyleSheet } from "react-native";

function postToHost(message: Record<string, unknown>) {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.parent) {
    try { window.parent.postMessage(message, "*"); } catch {}
  }
}

function postRuntimeError(message: string, componentStack?: string, jsStack?: string) {
  postToHost({ type: "RUNTIME_ERROR", error: message, componentStack, jsStack });
}

type State = { hasError: boolean; message?: string };

export class JoyloErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "Something went wrong" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    postRuntimeError(error?.message || "Unknown error", info?.componentStack ?? undefined, error?.stack ?? undefined);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message} numberOfLines={4}>{this.state.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export function useJoyloErrorHandlers() {
  React.useEffect(() => {
    if (Platform.OS !== "web") return;
    const raf = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (cb: FrameRequestCallback) => setTimeout(() => cb(0 as unknown as number), 0);
    raf(() => {
      raf(() => {
        postToHost({ type: "APP_READY" });
        postToHost({ type: "APP_RENDERED" });
      });
    });
    const onError = (e: ErrorEvent) => postRuntimeError(e.message, undefined, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) =>
      postRuntimeError(e.reason?.message || "Unhandled Promise Rejection", undefined, e.reason?.stack);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fafaf9" },
  title: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 8, textAlign: "center" },
  message: { fontSize: 12, color: "#64748b", textAlign: "center" },
});
/**
 * JOYLO INFRASTRUCTURE — DO NOT MODIFY OR DELETE
 * This file is protected by the Joylo platform.
 * It enables runtime error detection and the self-heal CTA in the Joylo UI.
 */
import React from "react";
import { Platform, View, Text, StyleSheet } from "react-native";

function postToHost(message: Record<string, unknown>) {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.parent) {
    try {
      window.parent.postMessage(message, "*");
    } catch {
      // host iframe origin restricted — ignore
    }
  }
}

function postRuntimeError(message: string, componentStack?: string, jsStack?: string) {
  postToHost({ type: "RUNTIME_ERROR", error: message, componentStack, jsStack });
}

type State = { hasError: boolean; message?: string };

export class JoyloErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "Something went wrong" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    postRuntimeError(
      error?.message || "Unknown error",
      info?.componentStack ?? undefined,
      error?.stack ?? undefined
    );
  }

  render() {
    if (this.state.hasError) {
      // Render a VISIBLE fallback instead of `null`. The Joylo host shows its
      // own rich error popup (driven by the RUNTIME_ERROR message above), but
      // this guarantees the iframe is never a bare white screen even if that
      // message is missed — the user always sees that something went wrong.
      return (
        <View style={styles.fallback}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message} numberOfLines={4}>
            {this.state.message}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export function useJoyloErrorHandlers() {
  React.useEffect(() => {
    if (Platform.OS !== "web") return;

    // Tell the host iframe that the app actually mounted AND painted. We post
    // after a double requestAnimationFrame so the signal fires only once the
    // browser has committed a real frame — not merely when React mounted off
    // the main chunk (which can be mid-bundle, before the first screen paints).
    // This is what lets the host swap the loader straight to real pixels with
    // no blank-white gap. Both names are sent: APP_RENDERED is the precise
    // signal; APP_READY is kept for backward compatibility with the host.
    const raf =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(0 as unknown as number), 0);
    raf(() => {
      raf(() => {
        postToHost({ type: "APP_READY" });
        postToHost({ type: "APP_RENDERED" });
      });
    });

    const onError = (e: ErrorEvent) =>
      postRuntimeError(e.message, undefined, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) =>
      postRuntimeError(
        e.reason?.message || "Unhandled Promise Rejection",
        undefined,
        e.reason?.stack
      );
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fafaf9",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
});

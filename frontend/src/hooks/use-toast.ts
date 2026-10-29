import { useState, useCallback } from "react";

export type ToastVariant = "default" | "destructive";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
}

// Simple module-level store so useToast works across components without a provider
let listeners: Array<(state: ToastState) => void> = [];
let state: ToastState = { toasts: [] };

function setState(next: ToastState) {
  state = next;
  listeners.forEach((l) => l(state));
}

export function toast(t: Omit<Toast, "id">) {
  const id = Math.random().toString(36).slice(2);
  setState({ toasts: [...state.toasts, { ...t, id }] });
  setTimeout(() => {
    setState({ toasts: state.toasts.filter((x) => x.id !== id) });
  }, 4000);
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(state.toasts);

  const subscribe = useCallback((listener: (s: ToastState) => void) => {
    listeners.push(listener);
    return () => { listeners = listeners.filter((l) => l !== listener); };
  }, []);

  useState(() => {
    const unsub = subscribe((s) => setToasts(s.toasts));
    return unsub;
  });

  return { toasts, toast };
}
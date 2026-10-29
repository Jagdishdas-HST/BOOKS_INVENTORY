import { useState, useEffect } from "react";
import { API_URL } from "@/constants/api";

let _online = true;
const _listeners = new Set<(v: boolean) => void>();

function notify(v: boolean) {
  if (_online === v) return;
  _online = v;
  _listeners.forEach((fn) => fn(v));
}

let _pollTimer: ReturnType<typeof setInterval> | null = null;

async function probe() {
  try {
    const res = await fetch(`${API_URL}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });
    notify(res.ok);
  } catch {
    notify(false);
  }
}

export function startConnectivityPolling() {
  if (_pollTimer) return;
  probe();
  _pollTimer = setInterval(probe, 8000);
}

export function stopConnectivityPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

export function getIsOnline() {
  return _online;
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(_online);
  useEffect(() => {
    _listeners.add(setOnline);
    probe();
    return () => { _listeners.delete(setOnline); };
  }, []);
  return online;
}
import { ReactNode, useEffect, useState } from "react";

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

// Renders children ONLY in the browser, never during SSR. Use for anything that touches
// browser globals or animates on mount: framer-motion, canvas/WebGL, charts, carousels,
// scroll/parallax effects, IntersectionObserver, window-size hooks, maps, video players.
// The fallback renders on the server, so pass a sized placeholder to avoid layout shift.
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children : fallback}</>;
}

export default ClientOnly;

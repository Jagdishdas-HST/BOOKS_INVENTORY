import { createContext, useContext } from 'react';

// Absolute site origin (e.g. https://example.com). Provided by the server
// during SSR so canonical/og:url render as absolute URLs; empty on the client
// where SEO falls back to window.location.origin.
export const SiteUrlContext = createContext<string>('');

export function useSiteUrl(): string {
  const fromContext = useContext(SiteUrlContext);
  if (fromContext) return fromContext;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

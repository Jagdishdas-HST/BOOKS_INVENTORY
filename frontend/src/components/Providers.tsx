import { ReactNode } from "react";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

const queryClient = new QueryClient();

// SINGLE SOURCE OF TRUTH for every app-wide provider. Both entries (main.tsx client,
// entry-server.tsx SSR) render this exact tree, so a provider added here is automatically
// present during SSR. Adding a provider anywhere else creates a client/server mismatch and
// crashes the SSR render with "useX must be used within XProvider".
// Add providers INSIDE this tree; keep the helmetContext prop or SSR drops every <SEO> tag from the served HTML.
interface ProvidersProps {
  children: ReactNode;
  // Only supplied by entry-server.tsx during SSR, so react-helmet-async can collect head tags.
  helmetContext?: Record<string, any>;
}

export function Providers({ children, helmetContext }: ProvidersProps) {
  return (
    <HelmetProvider {...(helmetContext ? { context: helmetContext } : {})}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default Providers;

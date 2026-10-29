import { ReactNode } from "react";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "@/components/ui/ToastContainer";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

interface ProvidersProps {
  children: ReactNode;
  helmetContext?: Record<string, any>;
}

export function Providers({ children, helmetContext }: ProvidersProps) {
  return (
    <HelmetProvider {...(helmetContext ? { context: helmetContext } : {})}>
      <QueryClientProvider client={queryClient}>
        {children}
        <ToastContainer />
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default Providers;
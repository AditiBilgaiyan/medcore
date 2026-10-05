"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError, errorMessage, refreshSession } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { silentError?: boolean };
  }
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err, query) => {
        // Background refetch failures: tell the user once, keep showing cached data.
        if (query.state.data !== undefined) toast.error(errorMessage(err));
      },
    }),
    mutationCache: new MutationCache({
      onError: (err, _vars, _ctx, mutation) => {
        if (!mutation.meta?.silentError) toast.error(errorMessage(err));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (count, err) => {
          // Don't retry client errors — they won't fix themselves.
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
          return count < 2;
        },
      },
    },
  });
}

/** Restores the session from the refresh-token cookie on first load. */
function AuthBootstrap() {
  useEffect(() => {
    const { status, setStatus, clear } = useAuthStore.getState();
    if (status !== "idle") return;
    setStatus("loading");
    void refreshSession().then((ok) => {
      if (!ok) clear();
    });
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={300}>
            <AuthBootstrap />
            {children}
            <Toaster richColors closeButton position="top-right" />
          </TooltipProvider>
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

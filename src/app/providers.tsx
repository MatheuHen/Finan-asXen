"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ensureResizeObserver } from "@/lib/ensure-resize-observer";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  ensureResizeObserver();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
          },
        },
      })
  );

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;
      const name =
        reason && typeof reason === "object" && "name" in reason ? String((reason as { name: unknown }).name) : "";
      const message =
        reason && typeof reason === "object" && "message" in reason
          ? String((reason as { message: unknown }).message)
          : "";

      if (name === "AbortError" && message.includes("Lock broken by another request")) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

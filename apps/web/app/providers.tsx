"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { system } from "@/lib/theme";

/**
 * Client-side provider boundary: the cockpit Chakra system + TanStack Query.
 * Query defaults are dashboard-tuned — we stare at this screen, so don't
 * refetch on every focus, but do recover on reconnect.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            staleTime: 60_000,
          },
        },
      }),
  );

  return (
    <ChakraProvider value={system}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ChakraProvider>
  );
}

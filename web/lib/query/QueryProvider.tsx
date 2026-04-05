"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * TanStack Query client provider. One QueryClient per browser session,
 * created inside `useState` so Next's Fast Refresh can't accidentally
 * dispose the cache during dev hot reloads.
 *
 * Defaults are tuned for this app:
 * - staleTime 30s so pool and team data isn't re-fetched every time you
 *   tab-focus; the Leaderboard query overrides this when a tournament
 *   goes live.
 * - refetchOnWindowFocus stays true because live leaderboards should
 *   catch up when the user returns from another tab.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

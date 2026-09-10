import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";

/**
 * Standard Next.js App Router + TanStack Query wiring: a fresh QueryClient
 * per server request (so one user's prefetched data is never reused for
 * another), and a browser-singleton client-side (so the notes cache
 * actually persists across client navigations instead of being recreated
 * per page). See getQueryClient() in providers/QueryProvider.tsx for the
 * singleton half.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Notes only change through our own mutations (save, rename,
        // create, delete, pin/archive), each of which writes the result
        // straight into this cache -- there's nothing external that makes
        // the data "go stale" on its own, so there's no reason to
        // background-refetch it.
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      dehydrate: {
        // Include pending queries in the dehydrated (server -> client)
        // payload too, not just settled ones -- keeps streaming/Suspense
        // usage correct if it's ever adopted here.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}

import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { listMyPoolsServer } from "@/lib/api/pools-server";
import { PoolList } from "@/components/pools/PoolList";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { ApiError } from "@/lib/api/client";

// Server component. Fetches /pools/mine upfront using the __session cookie,
// seeds the TanStack Query cache, and streams the HTML. First paint already
// has data — no loading spinner on cold load or route navigation.
export default async function PoolsPage() {
  const queryClient = new QueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: ["pools", "mine"],
      queryFn: listMyPoolsServer,
    });
  } catch (e) {
    // 401 here means the session cookie was invalid — middleware should've
    // caught it, but cookie could've been revoked mid-flight. Render an
    // error rather than crashing the whole page.
    const msg =
      e instanceof ApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Failed to load pools";
    return <ErrorAlert message={msg} />;
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PoolList />
    </HydrationBoundary>
  );
}

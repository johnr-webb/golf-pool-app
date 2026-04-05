import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import {
  getPoolDetailServer,
  getLeaderboardServer,
} from "@/lib/api/pools-server";
import { PoolDetailView } from "@/components/pools/PoolDetailView";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { ApiError } from "@/lib/api/client";

// Server component. Prefetches both the pool detail AND the leaderboard in
// parallel so the page renders with everything in place on first paint.
// Users see the scoreboard immediately when landing on an active pool.
export default async function PoolDetailPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;
  const queryClient = new QueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["pools", poolId, "detail"],
        queryFn: () => getPoolDetailServer(poolId),
      }),
      queryClient.prefetchQuery({
        queryKey: ["pools", poolId, "leaderboard"],
        queryFn: () => getLeaderboardServer(poolId),
      }),
    ]);
  } catch (e) {
    const msg =
      e instanceof ApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Failed to load pool";
    return <ErrorAlert message={msg} />;
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PoolDetailView poolId={poolId} />
    </HydrationBoundary>
  );
}

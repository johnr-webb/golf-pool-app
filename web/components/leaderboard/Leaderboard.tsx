"use client";

import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/api/pools";
import { LeaderboardUpcoming } from "./LeaderboardUpcoming";
import { LeaderboardActive } from "./LeaderboardActive";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingCard } from "@/components/common/LoadingCard";

export function Leaderboard({ poolId }: { poolId: string }) {
  // Hydrated on first render by the server component at /pools/[poolId],
  // then background-polled every 30s so live tournament scores update
  // without flickering the UI.
  const { data, error, isLoading } = useQuery({
    queryKey: ["pools", poolId, "leaderboard"],
    queryFn: () => getLeaderboard(poolId),
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });

  if (error) {
    return (
      <ErrorAlert
        message={
          error instanceof Error ? error.message : "Failed to load leaderboard"
        }
      />
    );
  }
  if (!data && isLoading) return <LoadingCard />;
  if (!data) return null;

  if (data.status === "upcoming") {
    return <LeaderboardUpcoming teams={data.teams} />;
  }
  return <LeaderboardActive entries={data.leaderboard} status={data.status} />;
}

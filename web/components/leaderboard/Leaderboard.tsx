"use client";

import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/api/pools";
import { LeaderboardUpcoming } from "./LeaderboardUpcoming";
import { LeaderboardActive } from "./LeaderboardActive";
import { MastersLeaderboard } from "@/components/masters/MastersLeaderboard";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingCard } from "@/components/common/LoadingCard";
import type { MastersLeaderboardResponse } from "@/lib/masters/types";

function isMastersResponse(data: unknown): data is MastersLeaderboardResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "mastersYear" in data &&
    typeof (data as Record<string, unknown>).mastersYear === "string"
  );
}

export function Leaderboard({ poolId }: { poolId: string }) {
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

  // Masters-specific rendering
  if (isMastersResponse(data)) {
    return <MastersLeaderboard data={data} />;
  }

  if (data.status === "upcoming") {
    return <LeaderboardUpcoming teams={data.teams} />;
  }
  return <LeaderboardActive entries={data.leaderboard} status={data.status} />;
}

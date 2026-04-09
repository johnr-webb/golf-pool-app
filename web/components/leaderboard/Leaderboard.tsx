"use client";

import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/api/pools";
import { LeaderboardUpcoming } from "./LeaderboardUpcoming";
import { LeaderboardActive } from "./LeaderboardActive";
import { MastersLeaderboardContainer } from "@/components/masters/MastersLeaderboardContainer";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingCard } from "@/components/common/LoadingCard";
import type { ScoringRule } from "@/lib/types/api";

interface Props {
  poolId: string;
  mastersYear?: string | null;
  scoringRule?: ScoringRule;
}

export function Leaderboard({ poolId, mastersYear, scoringRule }: Props) {
  // Masters: entirely separate data flow (client-side scoring via masters.com proxy)
  if (mastersYear && scoringRule) {
    return (
      <MastersLeaderboardContainer
        poolId={poolId}
        mastersYear={mastersYear}
        scoringRule={scoringRule}
      />
    );
  }

  return <EspnLeaderboard poolId={poolId} />;
}

/** Standard ESPN-backed leaderboard (non-Masters tournaments) */
function EspnLeaderboard({ poolId }: { poolId: string }) {
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

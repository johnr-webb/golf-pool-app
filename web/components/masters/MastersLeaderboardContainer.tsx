"use client";

// Orchestrates Masters data fetching and client-side scoring.
// Temporary: only used for the 2026 Masters tournament.

import { useQuery } from "@tanstack/react-query";
import {
  fetchMastersScores,
  fetchMastersPlayers,
  fetchMastersHoles,
  fetchTeamPicks,
} from "@/lib/masters/api";
import { buildMastersLeaderboard } from "@/lib/masters/scoring";
import { MastersLeaderboard } from "./MastersLeaderboard";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingCard } from "@/components/common/LoadingCard";
import type { ScoringRule } from "@/lib/types/api";

interface Props {
  poolId: string;
  mastersYear: string;
  scoringRule: ScoringRule;
}

export function MastersLeaderboardContainer({
  poolId,
  mastersYear,
  scoringRule,
}: Props) {
  // Team picks — refresh every 60s (picks don't change during active tournament)
  const {
    data: teamPicks,
    error: picksError,
  } = useQuery({
    queryKey: ["pools", poolId, "team-picks"],
    queryFn: () => fetchTeamPicks(poolId),
    staleTime: 60_000,
  });

  // Masters scores — refresh every 30s
  const {
    data: scoresData,
    error: scoresError,
  } = useQuery({
    queryKey: ["masters", "scores", mastersYear],
    queryFn: () => fetchMastersScores(mastersYear),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Masters players — once per session
  const { data: mastersPlayers } = useQuery({
    queryKey: ["masters", "players", mastersYear],
    queryFn: () => fetchMastersPlayers(mastersYear),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Masters holes — once per session
  const { data: rawHoles } = useQuery({
    queryKey: ["masters", "holes"],
    queryFn: () => fetchMastersHoles(),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const error = picksError || scoresError;
  if (error) {
    return (
      <ErrorAlert
        message={
          error instanceof Error ? error.message : "Failed to load Masters data"
        }
      />
    );
  }

  if (!teamPicks || !scoresData) return <LoadingCard />;

  const leaderboardData = buildMastersLeaderboard({
    mastersYear,
    teams: teamPicks.teams,
    scoresData,
    mastersPlayers: mastersPlayers ?? [],
    rawHoles: rawHoles ?? [],
    scoringRule,
  });

  return <MastersLeaderboard data={leaderboardData} />;
}

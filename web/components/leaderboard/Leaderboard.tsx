"use client";

import { useEffect, useState } from "react";
import { getLeaderboard } from "@/lib/api/pools";
import type { LeaderboardResponse } from "@/lib/types/api";
import { ApiError } from "@/lib/api/client";
import { LeaderboardUpcoming } from "./LeaderboardUpcoming";
import { LeaderboardActive } from "./LeaderboardActive";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingCard } from "@/components/common/LoadingCard";

export function Leaderboard({ poolId }: { poolId: string }) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLeaderboard(poolId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Failed to load leaderboard",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [poolId]);

  if (error) return <ErrorAlert message={error} />;
  if (data === null) return <LoadingCard />;

  if (data.status === "upcoming") {
    return <LeaderboardUpcoming teams={data.teams} />;
  }
  return <LeaderboardActive entries={data.leaderboard} status={data.status} />;
}

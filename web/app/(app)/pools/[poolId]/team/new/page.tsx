"use client";

import { use, useEffect, useState } from "react";
import { getPoolDetail } from "@/lib/api/pools";
import { listTournamentPlayers } from "@/lib/api/tournaments";
import type { PlayerDetail, PoolDetail } from "@/lib/types/api";
import { ApiError } from "@/lib/api/client";
import { TeamPicker } from "@/components/teams/TeamPicker";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingCard } from "@/components/common/LoadingCard";

export default function NewTeamPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = use(params);
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [players, setPlayers] = useState<PlayerDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getPoolDetail(poolId);
        if (cancelled) return;
        setPool(p);
        const roster = await listTournamentPlayers(p.tournamentId);
        if (cancelled) return;
        setPlayers(roster);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Failed to load pool",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [poolId]);

  if (error) return <ErrorAlert message={error} />;
  if (!pool || !players) return <LoadingCard />;

  const locked = pool.tournamentStatus !== "upcoming";

  return <TeamPicker pool={pool} players={players} locked={locked} />;
}

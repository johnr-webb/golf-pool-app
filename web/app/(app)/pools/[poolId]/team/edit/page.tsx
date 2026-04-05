"use client";

import { use, useEffect, useState } from "react";
import { getPoolDetail } from "@/lib/api/pools";
import { getTeam } from "@/lib/api/teams";
import { listTournamentPlayers } from "@/lib/api/tournaments";
import type {
  PlayerDetail,
  PoolDetail,
  TeamDetail,
} from "@/lib/types/api";
import { ApiError } from "@/lib/api/client";
import { TeamPicker } from "@/components/teams/TeamPicker";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingCard } from "@/components/common/LoadingCard";

export default function EditTeamPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = use(params);
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [players, setPlayers] = useState<PlayerDetail[] | null>(null);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getPoolDetail(poolId);
        if (cancelled) return;
        setPool(p);

        if (!p.myTeamId) {
          setError("You don't have a team in this pool yet.");
          return;
        }

        const [roster, t] = await Promise.all([
          listTournamentPlayers(p.tournamentId),
          getTeam(p.myTeamId),
        ]);
        if (cancelled) return;
        setPlayers(roster);
        setTeam(t);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Failed to load team",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [poolId]);

  if (error) return <ErrorAlert message={error} />;
  if (!pool || !players || !team) return <LoadingCard />;

  const locked = pool.tournamentStatus !== "upcoming";

  return (
    <TeamPicker
      pool={pool}
      players={players}
      teamId={team.id}
      initialName={team.name}
      initialPicks={team.players.map((p) => p.id)}
      locked={locked}
    />
  );
}

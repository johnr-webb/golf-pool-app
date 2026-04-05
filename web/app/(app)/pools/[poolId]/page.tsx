"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { getPoolDetail } from "@/lib/api/pools";
import type { PoolDetail } from "@/lib/types/api";
import { ApiError } from "@/lib/api/client";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";
import { TournamentStatusBadge } from "@/components/leaderboard/TournamentStatusBadge";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingCard } from "@/components/common/LoadingCard";

export default function PoolDetailPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = use(params);
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPoolDetail(poolId)
      .then((p) => {
        if (!cancelled) setPool(p);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Failed to load pool",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [poolId]);

  if (error) return <ErrorAlert message={error} />;
  if (!pool) return <LoadingCard />;

  const showCreateTeam =
    pool.tournamentStatus === "upcoming" && !pool.myTeamId;
  const showEditTeam =
    pool.tournamentStatus === "upcoming" && !!pool.myTeamId;

  return (
    <Stack gap="lg">
      <Button
        component={Link}
        href="/pools"
        variant="subtle"
        leftSection={<IconArrowLeft size={16} />}
        w="fit-content"
      >
        All pools
      </Button>

      <Stack gap="xs">
        <Group justify="space-between" wrap="wrap">
          <Stack gap={4}>
            <Title order={2}>{pool.name}</Title>
            <Group gap="xs">
              <Text c="dimmed">{pool.tournamentName ?? "—"}</Text>
              <TournamentStatusBadge status={pool.tournamentStatus} />
            </Group>
          </Stack>
          <Group gap="xs">
            {showCreateTeam && (
              <Button component={Link} href={`/pools/${poolId}/team/new`}>
                Create team
              </Button>
            )}
            {showEditTeam && (
              <Button
                component={Link}
                href={`/pools/${poolId}/team/edit`}
                variant="outline"
              >
                Edit team
              </Button>
            )}
          </Group>
        </Group>
        <Text size="sm" c="dimmed">
          Scoring: best {pool.scoringRule.countBest} of {pool.scoringRule.outOf}
          {" · "}
          {pool.tiers.length} tier{pool.tiers.length === 1 ? "" : "s"}
        </Text>
      </Stack>

      <Leaderboard poolId={poolId} />
    </Stack>
  );
}

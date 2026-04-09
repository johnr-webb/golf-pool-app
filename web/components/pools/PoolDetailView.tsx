"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { getPoolDetail } from "@/lib/api/pools";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";
import { TournamentStatusBadge } from "@/components/leaderboard/TournamentStatusBadge";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingCard } from "@/components/common/LoadingCard";

/**
 * Client wrapper for the pool detail page. Reads from the TanStack Query
 * cache which is pre-seeded by the parent server component. The useQuery
 * call also means edits to team name / picks automatically refetch the
 * header when the user navigates back from the team editor.
 */
export function PoolDetailView({ poolId }: { poolId: string }) {
  const { data: pool, error, isLoading } = useQuery({
    queryKey: ["pools", poolId, "detail"],
    queryFn: () => getPoolDetail(poolId),
  });

  if (error) {
    return (
      <ErrorAlert
        message={
          error instanceof Error ? error.message : "Failed to load pool"
        }
      />
    );
  }
  if (!pool && isLoading) return <LoadingCard />;
  if (!pool) return null;

  // Masters: skip the pool header, the Masters hero handles it
  if (pool.mastersYear) {
    return (
      <Leaderboard
        poolId={poolId}
        mastersYear={pool.mastersYear}
        scoringRule={pool.scoringRule}
      />
    );
  }

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
              <Text c="dimmed">{pool.tournamentName ?? "\u2014"}</Text>
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
          {" \u00b7 "}
          {pool.tiers.length} tier{pool.tiers.length === 1 ? "" : "s"}
        </Text>
      </Stack>

      <Leaderboard
        poolId={poolId}
        mastersYear={pool.mastersYear}
        scoringRule={pool.scoringRule}
      />
    </Stack>
  );
}

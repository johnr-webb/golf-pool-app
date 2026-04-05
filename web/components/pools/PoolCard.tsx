"use client";

import Link from "next/link";
import { Button, Card, Group, Stack, Text } from "@mantine/core";
import type { PoolSummary } from "@/lib/types/api";
import { TournamentStatusBadge } from "@/components/leaderboard/TournamentStatusBadge";

export function PoolCard({ pool }: { pool: PoolSummary }) {
  const canCreateTeam =
    pool.tournamentStatus === "upcoming" && !pool.myTeamId;
  const canEditTeam =
    pool.tournamentStatus === "upcoming" && !!pool.myTeamId;

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} size="lg" lineClamp={1}>
            {pool.name}
          </Text>
          <TournamentStatusBadge status={pool.tournamentStatus} />
        </Group>
        <Text size="sm" c="dimmed" lineClamp={1}>
          {pool.tournamentName ?? "Tournament unavailable"}
        </Text>
        <Group gap="xs" mt="sm">
          <Button
            component={Link}
            href={`/pools/${pool.id}`}
            variant="light"
            size="xs"
          >
            Leaderboard
          </Button>
          {canCreateTeam && (
            <Button
              component={Link}
              href={`/pools/${pool.id}/team/new`}
              size="xs"
            >
              Create team
            </Button>
          )}
          {canEditTeam && (
            <Button
              component={Link}
              href={`/pools/${pool.id}/team/edit`}
              size="xs"
              variant="outline"
            >
              Edit team
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

"use client";

import {
  Accordion,
  Badge,
  Card,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { LeaderboardEntry, TournamentStatus } from "@/lib/types/api";
import { formatScore } from "@/lib/utils/format";
import { PlayerScoreRow } from "./PlayerScoreRow";

export function LeaderboardActive({
  entries,
  status,
}: {
  entries: LeaderboardEntry[];
  status: Exclude<TournamentStatus, "upcoming">;
}) {
  if (entries.length === 0) {
    return (
      <Card withBorder p="xl">
        <Text c="dimmed" ta="center">
          No teams to score yet.
        </Text>
      </Card>
    );
  }

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Title order={3}>Leaderboard</Title>
        <Badge color={status === "active" ? "green" : "blue"} variant="light">
          {status === "active" ? "Live" : "Final"}
        </Badge>
      </Group>

      <Accordion multiple variant="separated" radius="md">
        {entries.map((entry, idx) => (
          <Accordion.Item key={entry.teamId} value={entry.teamId}>
            <Accordion.Control>
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <Text fw={700} w={28}>
                    {idx + 1}
                  </Text>
                  <Text fw={500} lineClamp={1}>
                    {entry.teamName}
                  </Text>
                </Group>
                <Text fw={700}>{formatScore(entry.totalScore)}</Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Divider mb="xs" />
              <Stack gap={0}>
                {entry.playerScores.map((p) => (
                  <PlayerScoreRow key={p.playerId} player={p} />
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}

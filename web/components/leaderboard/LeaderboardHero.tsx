"use client";

import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import type { EspnEventStatus } from "@/lib/types/api";
import { formatScore } from "@/lib/utils/format";

interface Props {
  tournamentName: string;
  status: "active" | "completed";
  eventStatus: EspnEventStatus | null;
  myTeamRank: number | null;
  myTeamScore: number | null;
  teamCount: number;
}

function ordinal(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function scoreColor(score: number | null): string | undefined {
  if (score === null || score === 0) return undefined;
  return score < 0 ? "teal" : "red";
}

export function LeaderboardHero({
  tournamentName,
  status,
  eventStatus,
  myTeamRank,
  myTeamScore,
  teamCount,
}: Props) {
  const detail = eventStatus?.detail || eventStatus?.shortDetail || "";

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Stack gap={2}>
            <Text fw={700} size="lg" lineClamp={1}>
              {tournamentName || "Tournament"}
            </Text>
            {detail && (
              <Text size="sm" c="dimmed">
                {detail}
              </Text>
            )}
          </Stack>
          <Badge
            color={status === "active" ? "green" : "blue"}
            variant="filled"
            size="md"
          >
            {status === "active" ? "Live" : "Final"}
          </Badge>
        </Group>

        <Group gap="xl" wrap="wrap" mt={4}>
          {myTeamRank !== null && (
            <Stack gap={0}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Your team
              </Text>
              <Group gap={6} align="baseline">
                <Text fw={700} size="xl">
                  {ordinal(myTeamRank)}
                </Text>
                <Text fw={600} c={scoreColor(myTeamScore)}>
                  ({formatScore(myTeamScore)})
                </Text>
              </Group>
            </Stack>
          )}
          <Stack gap={0}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Pool
            </Text>
            <Text fw={700} size="xl">
              {teamCount} {teamCount === 1 ? "team" : "teams"}
            </Text>
          </Stack>
        </Group>
      </Stack>
    </Card>
  );
}

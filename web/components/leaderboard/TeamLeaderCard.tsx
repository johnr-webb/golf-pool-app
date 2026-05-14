"use client";

import { Accordion, Divider, Group, Stack, Text } from "@mantine/core";
import type { LeaderboardEntry } from "@/lib/types/api";
import { formatScore } from "@/lib/utils/format";
import { PlayerScoreRow } from "./PlayerScoreRow";

const RANK_COLOR: Record<number, string> = {
  1: "#d4af37",
  2: "#a8a8a8",
  3: "#cd7f32",
};

function scoreColor(score: number): string | undefined {
  if (score === 0) return undefined;
  return score < 0 ? "teal" : "red";
}

interface Props {
  entry: LeaderboardEntry;
  rank: number;
  isMine: boolean;
}

export function TeamLeaderCard({ entry, rank, isMine }: Props) {
  const rankBg = RANK_COLOR[rank] ?? "var(--mantine-color-default-hover)";
  const rankFg = RANK_COLOR[rank] ? "#000" : undefined;

  return (
    <Accordion.Item
      value={entry.teamId}
      style={{
        borderLeft: `4px solid ${RANK_COLOR[rank] ?? "transparent"}`,
      }}
    >
      <Accordion.Control>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Stack
              align="center"
              justify="center"
              w={26}
              h={26}
              style={{
                background: rankBg,
                color: rankFg,
                borderRadius: "50%",
                fontWeight: 800,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {rank}
            </Stack>
            <Stack gap={0}>
              <Group gap={6} wrap="nowrap">
                <Text fw={600} lineClamp={1}>
                  {entry.teamName}
                </Text>
                {isMine && (
                  <Text size="xs" c="dimmed" fw={500}>
                    (you)
                  </Text>
                )}
              </Group>
              {entry.ownerName && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {entry.ownerName}
                </Text>
              )}
            </Stack>
          </Group>
          <Text fw={700} size="lg" c={scoreColor(entry.totalScore)}>
            {formatScore(entry.totalScore)}
          </Text>
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
  );
}

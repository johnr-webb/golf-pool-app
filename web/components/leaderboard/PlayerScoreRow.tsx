"use client";

import { Badge, Group, Text } from "@mantine/core";
import type { PlayerScore } from "@/lib/types/api";
import { formatScore } from "@/lib/utils/format";

export function PlayerScoreRow({ player }: { player: PlayerScore }) {
  return (
    <Group justify="space-between" wrap="nowrap" py={4}>
      <Group gap="xs" wrap="nowrap">
        <Text
          size="sm"
          fw={player.counting ? 600 : 400}
          c={player.counting ? undefined : "dimmed"}
          lineClamp={1}
        >
          {player.playerName}
        </Text>
        {player.missedCut && (
          <Badge color="red" size="xs" variant="light">
            Cut
          </Badge>
        )}
        {!player.counting && !player.missedCut && (
          <Badge color="gray" size="xs" variant="outline">
            Drop
          </Badge>
        )}
      </Group>
      <Text
        size="sm"
        fw={player.counting ? 600 : 400}
        c={player.counting ? undefined : "dimmed"}
      >
        {formatScore(player.score)}
      </Text>
    </Group>
  );
}

"use client";

import { Card, Group, Stack, Text } from "@mantine/core";
import type { ScoreboardLeader } from "@/lib/types/api";

const POSITION_COLOR: Record<number, string> = {
  1: "#d4af37",
  2: "#a8a8a8",
  3: "#cd7f32",
};

function scoreColor(score: string): string | undefined {
  if (!score || score === "E") return undefined;
  if (score.startsWith("-")) return "teal";
  if (score.startsWith("+")) return "red";
  return undefined;
}

export function LeadersTicker({ leaders }: { leaders: ScoreboardLeader[] }) {
  if (leaders.length === 0) return null;

  return (
    <Card withBorder padding="xs" radius="md">
      <Stack gap={6}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={700} px={6}>
          Tournament leaders
        </Text>
        <Group
          gap="xs"
          wrap="nowrap"
          px={6}
          pb={4}
          style={{ overflowX: "auto", scrollbarWidth: "none" }}
        >
          {leaders.map((leader, i) => {
            const pos = leader.position ?? i + 1;
            const posColor = POSITION_COLOR[pos];
            return (
              <Group
                key={`${leader.name}-${i}`}
                gap={6}
                wrap="nowrap"
                px={10}
                py={6}
                style={{
                  background: "var(--mantine-color-default-hover)",
                  borderRadius: 999,
                  flexShrink: 0,
                }}
              >
                <Text
                  size="xs"
                  fw={800}
                  style={{ color: posColor }}
                  c={posColor ? undefined : "dimmed"}
                >
                  {pos}
                </Text>
                <Text size="sm" fw={600}>
                  {leader.shortName}
                </Text>
                <Text size="sm" fw={700} c={scoreColor(leader.score)}>
                  {leader.score}
                </Text>
              </Group>
            );
          })}
        </Group>
      </Stack>
    </Card>
  );
}

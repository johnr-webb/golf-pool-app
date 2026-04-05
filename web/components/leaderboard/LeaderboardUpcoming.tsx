"use client";

import { Card, List, Stack, Text, Title } from "@mantine/core";
import type { UpcomingTeam } from "@/lib/types/api";

export function LeaderboardUpcoming({ teams }: { teams: UpcomingTeam[] }) {
  if (teams.length === 0) {
    return (
      <Card withBorder p="xl">
        <Text c="dimmed" ta="center">
          No teams have been created yet for this pool.
        </Text>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <Text c="dimmed" size="sm">
        Tournament hasn&apos;t started. Teams and picks are shown below.
      </Text>
      {teams.map((team) => (
        <Card key={team.teamId} withBorder padding="md">
          <Stack gap="xs">
            <Title order={4}>{team.teamName}</Title>
            <List size="sm" spacing={4}>
              {team.players.map((p) => (
                <List.Item key={p.id}>
                  <Text span fw={500}>
                    {p.name}
                  </Text>{" "}
                  <Text span c="dimmed" size="xs">
                    ({p.odds})
                  </Text>
                </List.Item>
              ))}
            </List>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

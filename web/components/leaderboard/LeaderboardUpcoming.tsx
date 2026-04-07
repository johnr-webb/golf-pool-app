"use client";

import { Accordion, Card, Group, Stack, Text, Title } from "@mantine/core";
import type { UpcomingTeam } from "@/lib/types/api";

export function LeaderboardUpcoming({ teams }: { teams: UpcomingTeam[] }) {
  if (teams.length === 0) {
    return (
      <Card withBorder p="xl">
        <Text c="dimmed" ta="center">
          Your team will appear here after you create it.
        </Text>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <Group gap="xs">
        <Title order={3}>My Team</Title>
      </Group>
      <Accordion variant="separated" radius="md">
        {teams.map((team) => (
          <Accordion.Item key={team.teamId} value={team.teamId}>
            <Accordion.Control>
              <Group justify="space-between" wrap="nowrap">
                <Text fw={500} lineClamp={1}>
                  {team.teamName}
                </Text>
                <Text fw={700} c="dimmed">
                  --
                </Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {team.players.map((p) => (
                  <Group key={p.id} justify="space-between" wrap="nowrap">
                    <Text fw={500}>{p.name}</Text>
                    <Text size="sm" c="dimmed">
                      {p.odds}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}

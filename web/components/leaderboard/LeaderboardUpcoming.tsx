"use client";

import {
  Accordion,
  Card,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
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
        <Title order={3}>Teams</Title>
      </Group>
      <Accordion variant="separated" radius="md">
        {teams.map((team) => (
          <Accordion.Item key={team.teamId} value={team.teamId}>
            <Accordion.Control
              icon={
                team.isMine ? undefined : (
                  <ThemeIcon variant="light" color="gray" size="sm" radius="xl">
                    <IconLock size={14} />
                  </ThemeIcon>
                )
              }
              disabled={!team.isMine}
            >
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={500} lineClamp={1}>
                    {team.teamName}
                  </Text>
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    Owner: {team.ownerName}
                  </Text>
                </Stack>
                <Text fw={700}>E</Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              {team.isMine ? (
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
              ) : (
                <Text size="sm" c="dimmed">
                  Hidden until the tournament starts.
                </Text>
              )}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}

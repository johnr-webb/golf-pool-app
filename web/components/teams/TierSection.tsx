"use client";

import { Badge, Group, MultiSelect, Paper, Stack, Text } from "@mantine/core";
import type { PlayerDetail, TierConfig } from "@/lib/types/api";

interface TierSectionProps {
  tier: TierConfig;
  eligiblePlayers: PlayerDetail[];
  selectedInTier: string[];
  onChange: (next: string[]) => void;
  satisfied: boolean;
  disabled?: boolean;
}

export function TierSection({
  tier,
  eligiblePlayers,
  selectedInTier,
  onChange,
  satisfied,
  disabled,
}: TierSectionProps) {
  const data = eligiblePlayers.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.odds})`,
  }));

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={600}>Tier {tier.tierNumber}</Text>
            <Text size="xs" c="dimmed">
              {tier.oddsMin} to {tier.oddsMax}
            </Text>
          </Stack>
          <Badge color={satisfied ? "green" : "gray"} variant="light">
            {selectedInTier.length} / {tier.picksRequired}
          </Badge>
        </Group>

        <MultiSelect
          data={data}
          value={selectedInTier}
          onChange={(next) => {
            // Enforce tier limit: silently ignore picks past the required count.
            if (next.length > tier.picksRequired) return;
            onChange(next);
          }}
          placeholder={`Pick ${tier.picksRequired} player${tier.picksRequired === 1 ? "" : "s"}`}
          searchable
          clearable={false}
          maxValues={tier.picksRequired}
          disabled={disabled}
          nothingFoundMessage="No eligible players"
        />
      </Stack>
    </Paper>
  );
}

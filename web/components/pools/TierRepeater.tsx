"use client";

import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { TierConfig } from "@/lib/types/api";

interface TierRepeaterProps {
  tiers: TierConfig[];
  onChange: (next: TierConfig[]) => void;
}

export function TierRepeater({ tiers, onChange }: TierRepeaterProps) {
  const updateTier = (index: number, patch: Partial<TierConfig>) => {
    const next = tiers.map((t, i) => (i === index ? { ...t, ...patch } : t));
    onChange(next);
  };

  const addTier = () => {
    onChange([
      ...tiers,
      {
        tierNumber: tiers.length + 1,
        oddsMin: "",
        oddsMax: "",
        picksRequired: 1,
      },
    ]);
  };

  const removeTier = (index: number) => {
    const next = tiers
      .filter((_, i) => i !== index)
      .map((t, i) => ({ ...t, tierNumber: i + 1 }));
    onChange(next);
  };

  return (
    <Stack gap="sm">
      <Text fw={500}>Tiers</Text>
      {tiers.map((tier, i) => (
        <Paper key={i} withBorder p="sm" radius="md">
          <Group align="flex-end" gap="sm" wrap="nowrap">
            <TextInput
              label={`Tier ${tier.tierNumber} · Min odds`}
              placeholder="+100"
              value={tier.oddsMin}
              onChange={(e) =>
                updateTier(i, { oddsMin: e.currentTarget.value })
              }
              w={140}
            />
            <TextInput
              label="Max odds"
              placeholder="+500"
              value={tier.oddsMax}
              onChange={(e) =>
                updateTier(i, { oddsMax: e.currentTarget.value })
              }
              w={140}
            />
            <NumberInput
              label="Picks"
              value={tier.picksRequired}
              onChange={(v) =>
                updateTier(i, { picksRequired: typeof v === "number" ? v : 1 })
              }
              min={1}
              max={20}
              w={100}
            />
            <ActionIcon
              color="red"
              variant="subtle"
              onClick={() => removeTier(i)}
              disabled={tiers.length <= 1}
              aria-label="Remove tier"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Paper>
      ))}
      <Button
        variant="light"
        leftSection={<IconPlus size={16} />}
        onClick={addTier}
        w="fit-content"
      >
        Add tier
      </Button>
    </Stack>
  );
}

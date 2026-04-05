"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconAlertCircle, IconCircleCheck } from "@tabler/icons-react";
import type { PlayerDetail, PoolDetail } from "@/lib/types/api";
import { createTeam, updateTeam } from "@/lib/api/teams";
import { ApiError } from "@/lib/api/client";
import { computeTierStatus } from "@/lib/validation/tiers";
import { TierSection } from "./TierSection";
import { TeamLockBanner } from "./TeamLockBanner";

interface TeamPickerProps {
  pool: PoolDetail;
  players: PlayerDetail[];
  teamId?: string;
  initialName?: string;
  initialPicks?: string[];
  locked?: boolean;
}

export function TeamPicker({
  pool,
  players,
  teamId,
  initialName = "",
  initialPicks = [],
  locked = false,
}: TeamPickerProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [picks, setPicks] = useState<string[]>(initialPicks);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { statuses, allSatisfied } = useMemo(
    () => computeTierStatus(players, pool.tiers, picks),
    [players, pool.tiers, picks],
  );

  const nameValid = name.trim().length > 0;
  const canSubmit = !locked && nameValid && allSatisfied && !submitting;

  const handleTierChange = (tierNumber: number, next: string[]) => {
    // Replace the picks belonging to this tier; keep picks from other tiers.
    const otherTierIds = statuses
      .filter((s) => s.tier.tierNumber !== tierNumber)
      .flatMap((s) => s.selectedPlayerIds);
    setPicks([...otherTierIds, ...next]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (teamId) {
        await updateTeam(teamId, { name: name.trim(), picks });
      } else {
        await createTeam(pool.id, { name: name.trim(), picks });
      }
      router.replace(`/pools/${pool.id}`);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to save team",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const totalSelected = picks.length;
  const totalRequired = pool.tiers.reduce(
    (sum, t) => sum + t.picksRequired,
    0,
  );

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Title order={2}>{teamId ? "Edit team" : "Create team"}</Title>
        <Text c="dimmed" size="sm">
          {pool.name} · Pick {totalRequired} players across {pool.tiers.length}{" "}
          tier{pool.tiers.length === 1 ? "" : "s"}. Scoring counts your best{" "}
          {pool.scoringRule.countBest} of {pool.scoringRule.outOf}.
        </Text>
      </Stack>

      {locked && <TeamLockBanner />}

      <TextInput
        label="Team name"
        placeholder="My team"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        disabled={locked}
        required
      />

      <Paper withBorder p="md" radius="md" bg="var(--mantine-color-default-hover)">
        <Group justify="space-between">
          <Group gap="xs">
            {allSatisfied ? (
              <IconCircleCheck size={18} color="var(--mantine-color-green-6)" />
            ) : null}
            <Text fw={500}>
              {totalSelected} / {totalRequired} picks
            </Text>
          </Group>
          <Text size="sm" c={allSatisfied ? "green" : "dimmed"}>
            {allSatisfied
              ? "All tiers satisfied"
              : "Fill every tier to continue"}
          </Text>
        </Group>
      </Paper>

      <Stack gap="md">
        {statuses.map((s) => (
          <TierSection
            key={s.tier.tierNumber}
            tier={s.tier}
            eligiblePlayers={s.eligiblePlayers}
            selectedInTier={s.selectedPlayerIds}
            satisfied={s.satisfied}
            disabled={locked}
            onChange={(next) => handleTierChange(s.tier.tierNumber, next)}
          />
        ))}
      </Stack>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error}
        </Alert>
      )}

      <Divider />

      <Group justify="flex-end">
        <Button variant="subtle" onClick={() => router.push(`/pools/${pool.id}`)}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit} loading={submitting}>
          {teamId ? "Save changes" : "Create team"}
        </Button>
      </Group>
    </Stack>
  );
}

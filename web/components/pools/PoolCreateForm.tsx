"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Divider,
  Group,
  NumberInput,
  PasswordInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { listTournaments } from "@/lib/api/tournaments";
import { createPool } from "@/lib/api/pools";
import type { TierConfig, TournamentSummary } from "@/lib/types/api";
import { ApiError } from "@/lib/api/client";
import { TierRepeater } from "./TierRepeater";

export function PoolCreateForm() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentSummary[] | null>(
    null,
  );
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [tiers, setTiers] = useState<TierConfig[]>([
    { tierNumber: 1, oddsMin: "+100", oddsMax: "+500", picksRequired: 2 },
    { tierNumber: 2, oddsMin: "+501", oddsMax: "+2000", picksRequired: 2 },
    { tierNumber: 3, oddsMin: "+2001", oddsMax: "+9999", picksRequired: 2 },
  ]);
  const [countBest, setCountBest] = useState<number>(4);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTournaments("upcoming")
      .then((t) => {
        if (!cancelled) setTournaments(t);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setTournamentsError(
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Failed to load tournaments",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const outOf = useMemo(
    () => tiers.reduce((sum, t) => sum + (t.picksRequired || 0), 0),
    [tiers],
  );

  const validationError = useMemo(() => {
    if (!name.trim()) return "Name is required";
    if (password.length < 4) return "Password must be at least 4 characters";
    if (!tournamentId) return "Pick a tournament";
    if (tiers.some((t) => !t.oddsMin || !t.oddsMax))
      return "Every tier needs min and max odds";
    if (outOf === 0) return "Tiers must require at least one pick total";
    if (countBest < 1 || countBest > outOf)
      return `Best-of must be between 1 and ${outOf}`;
    return null;
  }, [name, password, tournamentId, tiers, outOf, countBest]);

  const canSubmit = !validationError && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !tournamentId) return;
    setSubmitting(true);
    setError(null);
    try {
      const { id } = await createPool({
        name: name.trim(),
        password,
        tournamentId,
        tiers,
        scoringRule: { countBest, outOf },
      });
      startTransition(() => {
        router.replace(`/pools/${id}`);
        router.refresh();
      });
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to create pool",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        <Title order={2}>New pool</Title>

        {tournamentsError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {tournamentsError}
          </Alert>
        )}

        {tournaments && tournaments.length === 0 && (
          <Alert color="yellow">
            No upcoming tournaments exist yet. An admin needs to create a
            tournament before you can start a pool.
          </Alert>
        )}

        <TextInput
          label="Pool name"
          placeholder="Friends League 2026"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

        <PasswordInput
          label="Pool password"
          description="Other players will need this to join."
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          required
        />

        <Select
          label="Tournament"
          placeholder={tournaments ? "Select a tournament" : "Loading…"}
          data={
            tournaments?.map((t) => ({ value: t.id, label: t.name })) ?? []
          }
          value={tournamentId}
          onChange={setTournamentId}
          disabled={!tournaments || tournaments.length === 0}
          required
          searchable
        />

        <TierRepeater tiers={tiers} onChange={setTiers} />

        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Text fw={500}>Scoring rule</Text>
            <Group align="flex-end" gap="sm">
              <NumberInput
                label="Count best"
                value={countBest}
                onChange={(v) =>
                  setCountBest(typeof v === "number" ? v : 1)
                }
                min={1}
                max={outOf || 1}
                w={120}
              />
              <Text c="dimmed" pb={8}>
                of {outOf} total picks
              </Text>
            </Group>
          </Stack>
        </Paper>

        {validationError && (
          <Text size="sm" c="dimmed">
            {validationError}
          </Text>
        )}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {error}
          </Alert>
        )}

        <Divider />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => router.push("/pools")}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit} loading={submitting}>
            Create pool
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

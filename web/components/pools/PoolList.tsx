"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { listMyPools } from "@/lib/api/pools";
import type { PoolSummary } from "@/lib/types/api";
import { ApiError } from "@/lib/api/client";
import { PoolCard } from "./PoolCard";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingCard } from "@/components/common/LoadingCard";

export function PoolList() {
  const [pools, setPools] = useState<PoolSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyPools()
      .then((data) => {
        if (!cancelled) setPools(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Failed to load pools",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <ErrorAlert message={error} />;
  if (pools === null) return <LoadingCard />;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>My Pools</Title>
        <Button
          component={Link}
          href="/pools/new"
          leftSection={<IconPlus size={16} />}
        >
          New pool
        </Button>
      </Group>

      {pools.length === 0 ? (
        <Paper p="xl" withBorder ta="center">
          <Stack gap="sm" align="center">
            <Text fw={500}>You&apos;re not in any pools yet.</Text>
            <Text size="sm" c="dimmed">
              Create a new pool or ask a friend for their pool link and password.
            </Text>
            <Button component={Link} href="/pools/new" mt="sm">
              Create your first pool
            </Button>
          </Stack>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {pools.map((p) => (
            <PoolCard key={p.id} pool={p} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

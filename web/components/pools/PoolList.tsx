"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconPlus, IconUsersGroup } from "@tabler/icons-react";
import { listMyPools } from "@/lib/api/pools";
import { PoolCard } from "./PoolCard";
import { JoinPoolModal } from "./JoinPoolModal";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingCard } from "@/components/common/LoadingCard";
import { useAuth } from "@/lib/auth/AuthProvider";

export function PoolList() {
  const { me } = useAuth();
  const [joinOpen, setJoinOpen] = useState(false);

  // Query cache is pre-seeded by the server component at `/pools` via
  // HydrationBoundary, so this hook returns data synchronously on first
  // render — no spinner flash. Background refetch still runs to pick up
  // any changes since the server fetched.
  const { data: pools, error, isLoading } = useQuery({
    queryKey: ["pools", "mine"],
    queryFn: listMyPools,
  });

  const isAdmin = me?.admin === true;

  if (error) {
    return (
      <ErrorAlert
        message={error instanceof Error ? error.message : "Failed to load pools"}
      />
    );
  }
  // Only reached when there's no hydrated cache (e.g. direct client-side
  // navigation that bypassed the server component). Server-rendered first
  // loads skip this branch entirely.
  if (!pools && isLoading) return <LoadingCard />;
  if (!pools) return null;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>My Pools</Title>
        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconUsersGroup size={16} />}
            onClick={() => setJoinOpen(true)}
          >
            Join pool
          </Button>
          {isAdmin && (
            <Button
              component={Link}
              href="/pools/new"
              leftSection={<IconPlus size={16} />}
            >
              New pool
            </Button>
          )}
        </Group>
      </Group>

      {pools.length === 0 ? (
        <Paper p="xl" withBorder ta="center">
          <Stack gap="sm" align="center">
            <Text fw={500}>You&apos;re not in any pools yet.</Text>
            <Text size="sm" c="dimmed" maw={420}>
              {isAdmin
                ? "Create a new pool to get started, or join an existing one with a pool ID and password."
                : "Ask your pool admin for an invite link, or click \u201CJoin pool\u201D above if they gave you a pool ID and password."}
            </Text>
            <Group gap="xs" mt="sm">
              <Button
                variant="default"
                onClick={() => setJoinOpen(true)}
                leftSection={<IconUsersGroup size={16} />}
              >
                Join pool
              </Button>
              {isAdmin && (
                <Button
                  component={Link}
                  href="/pools/new"
                  leftSection={<IconPlus size={16} />}
                >
                  Create pool
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {pools.map((p) => (
            <PoolCard key={p.id} pool={p} />
          ))}
        </SimpleGrid>
      )}

      <JoinPoolModal opened={joinOpen} onClose={() => setJoinOpen(false)} />
    </Stack>
  );
}

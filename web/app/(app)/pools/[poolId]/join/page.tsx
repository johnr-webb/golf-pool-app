"use client";

import { startTransition, use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Group,
  PasswordInput,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { joinPool } from "@/lib/api/pools";
import { ApiError } from "@/lib/api/client";

export default function JoinPoolPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = use(params);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await joinPool(poolId, password);
      // On success, go straight to team creation.
      startTransition(() => {
        router.replace(`/pools/${poolId}`);
        router.refresh();
      });
    } catch (e) {
      // 409 means "already have a team" — route to the leaderboard instead.
      if (e instanceof ApiError && e.status === 409) {
        startTransition(() => {
          router.replace(`/pools/${poolId}`);
          router.refresh();
        });
        return;
      }
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to join pool",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap="lg" maw={480}>
      <Title order={2}>Join pool</Title>
      <Text c="dimmed" size="sm">
        Enter the pool password shared by the pool creator. You&apos;ll be
        taken to the team picker next.
      </Text>
      <Paper withBorder p="md" radius="md">
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <PasswordInput
              label="Pool password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />
            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                {error}
              </Alert>
            )}
            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={() => router.push("/pools")}
                type="button"
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Join
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}

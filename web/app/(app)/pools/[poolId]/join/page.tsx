"use client";

import {
  startTransition,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Group,
  Loader,
  PasswordInput,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { joinPool } from "@/lib/api/pools";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function JoinPoolPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  // Share links carry the pool password as ?pw= so invitees join in one tap.
  const prefillPassword = searchParams.get("pw") ?? "";
  const [password, setPassword] = useState(prefillPassword);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Show a loader (not the form) while a share-link join is in flight.
  const [autoJoining, setAutoJoining] = useState(prefillPassword.length > 0);
  const autoAttempted = useRef(false);

  const runJoin = useCallback(
    async (pw: string) => {
      setSubmitting(true);
      setError(null);
      try {
        await joinPool(poolId, pw);
        // On success, go to the pool (team picker if no team yet).
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
        // Fall back to the manual form so they can correct and retry.
        setAutoJoining(false);
      } finally {
        setSubmitting(false);
      }
    },
    [poolId, router],
  );

  // Auto-join once auth has hydrated, when a password came in via the link.
  useEffect(() => {
    if (prefillPassword && user && !autoAttempted.current) {
      autoAttempted.current = true;
      void runJoin(prefillPassword);
    }
  }, [prefillPassword, user, runJoin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runJoin(password);
  };

  if (autoJoining) {
    return (
      <Stack gap="md" maw={480} align="center" mt="xl">
        <Loader />
        <Text c="dimmed" size="sm">
          Joining the pool…
        </Text>
      </Stack>
    );
  }

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

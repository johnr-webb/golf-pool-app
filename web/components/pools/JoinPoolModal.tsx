"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { joinPool } from "@/lib/api/pools";
import { ApiError } from "@/lib/api/client";

interface Props {
  opened: boolean;
  onClose: () => void;
}

/**
 * Modal affordance for joining a pool without a full invite link.
 * Pool ID + password is the same handshake as /pools/[poolId]/join, just
 * collected in one place on /pools for users who were given the ID verbally.
 */
export function JoinPoolModal({ opened, onClose }: Props) {
  const router = useRouter();
  const [poolId, setPoolId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPoolId("");
    setPassword("");
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = poolId.trim();
    if (!trimmedId) {
      setError("Pool ID is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await joinPool(trimmedId, password);
      router.replace(`/pools/${trimmedId}/team/new`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Already have a team — drop them on the pool detail instead.
        router.replace(`/pools/${trimmedId}`);
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
    <Modal opened={opened} onClose={handleClose} title="Join a pool" centered>
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Ask your pool admin for the pool ID and password. If they sent you
            an invite link instead, just click the link.
          </Text>
          <TextInput
            label="Pool ID"
            placeholder="abc123..."
            value={poolId}
            onChange={(e) => setPoolId(e.currentTarget.value)}
            required
            data-autofocus
          />
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
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Join
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

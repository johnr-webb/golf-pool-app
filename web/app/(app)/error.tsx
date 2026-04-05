"use client";

import { Button, Stack, Text, Title } from "@mantine/core";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Stack align="center" gap="md" mt="xl">
      <Title order={3}>Something went wrong</Title>
      <Text c="dimmed" size="sm">
        {error.message || "An unexpected error occurred."}
      </Text>
      <Button onClick={reset}>Try again</Button>
    </Stack>
  );
}

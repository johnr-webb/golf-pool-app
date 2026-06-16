"use client";

import type { ReactNode } from "react";
import { Box, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconTrophy } from "@tabler/icons-react";

/**
 * Branded empty state — a large faded silver U.S. Open-style trophy watermark
 * behind a centered message. Used across pool/leaderboard empty branches.
 */
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Paper
      withBorder
      p="xl"
      radius="md"
      ta="center"
      pos="relative"
      style={{
        overflow: "hidden",
        borderTop: "3px solid var(--mantine-color-usoNavy-9)",
      }}
    >
      {/* Trophy watermark */}
      <Box
        pos="absolute"
        style={{
          right: -24,
          bottom: -32,
          opacity: 0.06,
          pointerEvents: "none",
          color: "var(--mantine-color-usoNavy-9)",
        }}
      >
        <IconTrophy size={220} stroke={1.25} />
      </Box>

      <Stack gap="sm" align="center" pos="relative">
        <ThemeIcon
          size={64}
          radius="xl"
          variant="light"
          color="usoSilver"
          style={{ color: "var(--mantine-color-usoNavy-9)" }}
        >
          <IconTrophy size={34} stroke={1.5} />
        </ThemeIcon>
        <Text fw={700} size="lg" c="usoNavy.9">
          {title}
        </Text>
        {description && (
          <Text size="sm" c="dimmed" maw={460}>
            {description}
          </Text>
        )}
        {children}
      </Stack>
    </Paper>
  );
}

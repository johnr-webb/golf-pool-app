"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AppShell as MantineAppShell,
  Group,
  Anchor,
  Container,
  Box,
  Stack,
  Text,
} from "@mantine/core";
import { USOpenLogo } from "@/components/brand/USOpenLogo";
import { UserMenu } from "./UserMenu";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MantineAppShell header={{ height: 72 }} padding="md">
      <MantineAppShell.Header
        style={{
          background: "var(--mantine-color-white)",
          borderBottom: "3px solid var(--mantine-color-usoNavy-9)",
        }}
      >
        {/* Americana accent stripe */}
        <Box h={4} bg="usoRed.6" />
        <Group h="calc(100% - 4px)" px="md" justify="space-between" wrap="nowrap">
          <Anchor component={Link} href="/pools" underline="never">
            <USOpenLogo height={40} priority />
          </Anchor>
          <UserMenu />
        </Group>
      </MantineAppShell.Header>
      <MantineAppShell.Main bg="gray.0">
        <Container size="lg" pb="xl">
          {children}
        </Container>

        {/* Branded footer */}
        <Box
          mt="xl"
          py="lg"
          style={{
            background: "var(--mantine-color-usoNavy-9)",
            borderTop: "4px solid var(--mantine-color-usoRed-6)",
          }}
        >
          <Container size="lg">
            <Stack gap="xs" align="center">
              <Box
                px="md"
                py={6}
                bg="white"
                style={{ borderRadius: "var(--mantine-radius-sm)" }}
              >
                <USOpenLogo height={26} />
              </Box>
              <Text size="xs" c="white" ta="center" opacity={0.75}>
                U.S. Open Pool · Picks, tiers &amp; live scoring · For entertainment only
              </Text>
            </Stack>
          </Container>
        </Box>
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AppShell as MantineAppShell,
  Group,
  Anchor,
  Container,
} from "@mantine/core";
import { UserMenu } from "./UserMenu";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MantineAppShell header={{ height: 60 }} padding="md">
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Anchor
            component={Link}
            href="/pools"
            c="inherit"
            underline="never"
            fw={700}
            size="lg"
          >
            Golf Pool
          </Anchor>
          <UserMenu />
        </Group>
      </MantineAppShell.Header>
      <MantineAppShell.Main>
        <Container size="lg">{children}</Container>
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}

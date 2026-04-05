"use client";

import { Center, Loader, Paper } from "@mantine/core";

export function LoadingCard({ height = 200 }: { height?: number }) {
  return (
    <Paper p="xl" withBorder>
      <Center mih={height}>
        <Loader />
      </Center>
    </Paper>
  );
}

"use client";

import { Alert } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";

export function TeamLockBanner() {
  return (
    <Alert icon={<IconLock size={16} />} color="yellow" title="Picks locked">
      The tournament has started. You can no longer edit this team&apos;s picks.
    </Alert>
  );
}

"use client";

import { Badge } from "@mantine/core";
import type { TournamentStatus } from "@/lib/types/api";

const COLOR_BY_STATUS: Record<TournamentStatus, string> = {
  upcoming: "gray",
  active: "green",
  completed: "blue",
};

const LABEL_BY_STATUS: Record<TournamentStatus, string> = {
  upcoming: "Upcoming",
  active: "Live",
  completed: "Completed",
};

export function TournamentStatusBadge({
  status,
}: {
  status: TournamentStatus | null;
}) {
  if (!status) return null;
  return (
    <Badge color={COLOR_BY_STATUS[status]} variant="light">
      {LABEL_BY_STATUS[status]}
    </Badge>
  );
}

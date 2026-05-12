// Display helpers.

import type { TournamentStatus } from "@/lib/types/api";

/**
 * Derive tournament status from its ISO start/end date strings.
 * Called at render time so the status is always fresh.
 */
export function statusFromDates(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): TournamentStatus {
  if (!startDate || !endDate) return "upcoming";
  const now = new Date();
  if (now > new Date(endDate)) return "completed";
  if (now >= new Date(startDate)) return "active";
  return "upcoming";
}

/**
 * Format a golf score relative to par: -3 → "-3", 0 → "E", +4 → "+4".
 */
export function formatScore(score: number | null): string {
  if (score == null) return "—";
  if (score === 0) return "E";
  if (score > 0) return `+${score}`;
  return `${score}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

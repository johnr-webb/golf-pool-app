// Display helpers.

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

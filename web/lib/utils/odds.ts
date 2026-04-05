// Parse American odds strings like "+450", "-120", "+9999".
// Returns a numeric value suitable for range comparisons.
// NOTE: this must match the semantics used by functions/src/services/validation.ts
// — backend is authoritative. This exists for client-side UX only.

export function parseOdds(odds: string): number {
  const trimmed = odds.trim();
  const n = Number(trimmed);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid odds string: ${odds}`);
  }
  return n;
}

/**
 * Returns true if the player's odds fall within [oddsMin, oddsMax] inclusive.
 * In American odds, a "smaller" number = shorter odds = favorite (e.g. +100 < +500).
 */
export function oddsInRange(
  playerOdds: string,
  oddsMin: string,
  oddsMax: string,
): boolean {
  const p = parseOdds(playerOdds);
  const min = parseOdds(oddsMin);
  const max = parseOdds(oddsMax);
  return p >= min && p <= max;
}

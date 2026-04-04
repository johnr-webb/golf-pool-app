import { TierConfig } from "../types";

/**
 * Parse odds string like "+600" or "-110" to a numeric value.
 * More positive = longer odds (worse chance).
 */
export function parseOdds(odds: string): number {
  return parseInt(odds.replace("+", ""), 10);
}

/**
 * Check if a player's odds fall within a tier's range.
 * Odds ranges: oddsMin is the lower bound (shorter odds / better),
 * oddsMax is the upper bound (longer odds / worse).
 * E.g., tier with oddsMin "+400" and oddsMax "+800" includes "+600".
 */
export function isInTier(playerOdds: string, tier: TierConfig): boolean {
  const odds = parseOdds(playerOdds);
  const min = parseOdds(tier.oddsMin);
  const max = parseOdds(tier.oddsMax);
  return odds >= min && odds <= max;
}

/**
 * Validate that a set of picks satisfies the pool's tier requirements.
 * Each player must fall into exactly one tier, and each tier must have
 * exactly picksRequired players.
 */
export function validatePicks(
  picks: { playerId: string; odds: string }[],
  tiers: TierConfig[]
): { valid: boolean; error?: string } {
  // Group picks by tier
  const tierPicks: Map<number, string[]> = new Map();
  for (const tier of tiers) {
    tierPicks.set(tier.tierNumber, []);
  }

  for (const pick of picks) {
    let assignedTier: number | null = null;
    for (const tier of tiers) {
      if (isInTier(pick.odds, tier)) {
        assignedTier = tier.tierNumber;
        break;
      }
    }
    if (assignedTier === null) {
      return {
        valid: false,
        error: `Player ${pick.playerId} with odds ${pick.odds} doesn't fit any tier`,
      };
    }
    tierPicks.get(assignedTier)!.push(pick.playerId);
  }

  // Check each tier has the right number of picks
  for (const tier of tiers) {
    const count = tierPicks.get(tier.tierNumber)!.length;
    if (count !== tier.picksRequired) {
      return {
        valid: false,
        error: `Tier ${tier.tierNumber} requires ${tier.picksRequired} picks, got ${count}`,
      };
    }
  }

  return { valid: true };
}

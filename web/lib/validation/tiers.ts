// Client-side mirror of backend tier validation (functions/src/services/validation.ts).
// Backend is authoritative — this exists purely to give the team picker live feedback.
// Any divergence = bug. If backend validation changes, update this file too.

import type { PlayerDetail, TierConfig } from "@/lib/types/api";
import { oddsInRange } from "@/lib/utils/odds";

export interface TierStatus {
  tier: TierConfig;
  eligiblePlayers: PlayerDetail[];
  selectedPlayerIds: string[];
  selected: number;
  required: number;
  satisfied: boolean;
}

/**
 * Assign each player to exactly one tier based on the player's odds.
 * Players who don't match any tier land in the `unassigned` bucket.
 */
export function groupPlayersByTier(
  players: PlayerDetail[],
  tiers: TierConfig[],
): { byTier: Map<number, PlayerDetail[]>; unassigned: PlayerDetail[] } {
  const byTier = new Map<number, PlayerDetail[]>();
  tiers.forEach((t) => byTier.set(t.tierNumber, []));
  const unassigned: PlayerDetail[] = [];

  for (const player of players) {
    const tier = tiers.find((t) =>
      oddsInRange(player.odds, t.oddsMin, t.oddsMax),
    );
    if (tier) {
      byTier.get(tier.tierNumber)!.push(player);
    } else {
      unassigned.push(player);
    }
  }

  return { byTier, unassigned };
}

/**
 * Given the current selection, compute per-tier status for rendering the
 * TeamPicker UI. `selectedPlayerIds` is the flat list of player IDs picked
 * across all tiers.
 */
export function computeTierStatus(
  players: PlayerDetail[],
  tiers: TierConfig[],
  selectedPlayerIds: string[],
): { statuses: TierStatus[]; allSatisfied: boolean } {
  const { byTier } = groupPlayersByTier(players, tiers);
  const selectedSet = new Set(selectedPlayerIds);

  const statuses: TierStatus[] = tiers.map((tier) => {
    const eligible = byTier.get(tier.tierNumber) ?? [];
    const selectedInTier = eligible
      .filter((p) => selectedSet.has(p.id))
      .map((p) => p.id);
    return {
      tier,
      eligiblePlayers: eligible,
      selectedPlayerIds: selectedInTier,
      selected: selectedInTier.length,
      required: tier.picksRequired,
      satisfied: selectedInTier.length === tier.picksRequired,
    };
  });

  return {
    statuses,
    allSatisfied: statuses.every((s) => s.satisfied),
  };
}

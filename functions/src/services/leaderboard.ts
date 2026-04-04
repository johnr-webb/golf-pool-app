import { ScoringRule, LeaderboardEntry } from "../types";

interface PlayerScore {
  playerId: string;
  playerName: string;
  espnId: string | null;
  score: number | null; // null if no ESPN data
  missedCut: boolean;
}

/**
 * Parse ESPN score string like "-14", "+2", "E" to a number.
 */
export function parseScore(score: string): number {
  if (score === "E") return 0;
  return parseInt(score, 10);
}

/**
 * Apply missed-cut penalty: players who missed the cut get assigned
 * the worst score among players who made the cut.
 */
export function applyMissedCutPenalty(
  allScores: Map<string, { score: number; missedCut: boolean }>
): Map<string, { score: number; missedCut: boolean }> {
  let worstMadeCut = -Infinity;

  for (const entry of allScores.values()) {
    if (!entry.missedCut && entry.score > worstMadeCut) {
      worstMadeCut = entry.score;
    }
  }

  // If no one made the cut (shouldn't happen), just return as-is
  if (worstMadeCut === -Infinity) return allScores;

  const result = new Map(allScores);
  for (const [id, entry] of result) {
    if (entry.missedCut) {
      result.set(id, { score: worstMadeCut, missedCut: true });
    }
  }
  return result;
}

/**
 * Calculate a team's total score using the pool's scoring rule.
 * Takes the best `countBest` scores out of all picks.
 */
export function calculateTeamScore(
  playerScores: PlayerScore[],
  scoringRule: ScoringRule
): LeaderboardEntry["playerScores"] & { totalScore: number } {
  // Sort by score ascending (best = lowest in golf)
  const sorted = [...playerScores].sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return a.score - b.score;
  });

  const result = sorted.map((ps, i) => ({
    playerId: ps.playerId,
    playerName: ps.playerName,
    score: ps.score,
    missedCut: ps.missedCut,
    counting: i < scoringRule.countBest,
  }));

  const totalScore = result
    .filter((r) => r.counting)
    .reduce((sum, r) => sum + (r.score ?? 0), 0);

  return Object.assign(result, { totalScore });
}

import { ScoringRule, LeaderboardEntry, EspnCompetitor, ScoreboardLeader } from "../types";

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

/**
 * Pick the top N competitors for the leaders ticker. Sorts by ESPN's `order`
 * field (1 = leader) and falls back to score-ascending for ties / missing order.
 * Missed-cut competitors are excluded.
 */
export function buildLeaders(
  competitors: EspnCompetitor[],
  limit = 10,
): ScoreboardLeader[] {
  const playing = competitors.filter(
    (c) =>
      c.status?.type?.name !== "STATUS_CUT" &&
      !c.status?.type?.description?.toLowerCase().includes("cut") &&
      !c.status?.type?.description?.toLowerCase().includes("withdrawn"),
  );

  const sorted = [...playing].sort((a, b) => {
    const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return parseScore(a.score) - parseScore(b.score);
  });

  return sorted.slice(0, limit).map((c, i) => ({
    position: c.order ?? i + 1,
    name: c.athlete.fullName,
    shortName: c.athlete.shortName ?? c.athlete.displayName,
    score: c.score,
    country: c.athlete.flag?.alt ?? null,
  }));
}

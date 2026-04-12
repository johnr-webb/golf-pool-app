// Masters client-side scoring — ported from functions/src/services/masters.ts
// Temporary: only used for the 2026 Masters tournament.

import type { ScoringRule, TeamPick } from "@/lib/types/api";
import type {
  MastersRawPlayer,
  MastersRawScorePlayer,
  MastersRawScoresData,
  MastersRawHole,
  MastersLeader,
  MastersHoleInfo,
  MastersPlayerRound,
  MastersPlayerScore,
  MastersLeaderboardEntry,
  MastersLeaderboardResponse,
} from "./types";

// --- Name matching ---

/**
 * Characters that survive NFD decomposition — standalone Unicode code points
 * (not base + combining mark), so the accent-stripping regex won't touch them.
 */
const SPECIAL_CHARS: Record<string, string> = {
  "\u00f8": "o", // ø
  "\u00d8": "O", // Ø
  "\u00e6": "ae", // æ
  "\u00c6": "AE", // Æ
  "\u00f0": "d", // ð
  "\u00d0": "D", // Ð
  "\u00df": "ss", // ß
  "\u0111": "d", // đ
  "\u0110": "D", // Đ
  "\u0142": "l", // ł
  "\u0141": "L", // Ł
};

function normalizeName(name: string): string {
  let s = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [from, to] of Object.entries(SPECIAL_CHARS)) {
    s = s.split(from).join(to);
  }
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchMastersPlayer(
  playerName: string,
  scorePlayers: MastersRawScorePlayer[],
  mastersPlayers: MastersRawPlayer[],
): {
  scorePlayer: MastersRawScorePlayer | null;
  bioPlayer: MastersRawPlayer | null;
} {
  const norm = normalizeName(playerName);
  const normParts = norm.split(" ");
  const ourFirst = normParts[0];
  const ourLast = normParts[normParts.length - 1];

  // Score player: full name → first+last components → unique last name
  let scorePlayer =
    scorePlayers.find((p) => normalizeName(p.full_name) === norm) ?? null;

  if (!scorePlayer) {
    scorePlayer = scorePlayers.find(
      (p) =>
        normalizeName(p.first_name) === ourFirst &&
        normalizeName(p.last_name) === ourLast,
    ) ?? null;
  }

  if (!scorePlayer) {
    const lastNameMatches = scorePlayers.filter(
      (p) => normalizeName(p.last_name) === ourLast,
    );
    if (lastNameMatches.length === 1) {
      scorePlayer = lastNameMatches[0];
    }
  }

  // Bio player: same cascade
  let bioPlayer =
    mastersPlayers.find((p) => normalizeName(p.name) === norm) ?? null;

  if (!bioPlayer) {
    bioPlayer = mastersPlayers.find(
      (p) =>
        normalizeName(p.first_name) === ourFirst &&
        normalizeName(p.last_name) === ourLast,
    ) ?? null;
  }

  if (!bioPlayer) {
    const lastNameMatches = mastersPlayers.filter(
      (p) => normalizeName(p.last_name) === ourLast,
    );
    if (lastNameMatches.length === 1) {
      bioPlayer = lastNameMatches[0];
    }
  }

  return { scorePlayer, bioPlayer };
}

// --- Scoring ---

function applyMissedCutPenalty(
  allScores: Map<string, { score: number; missedCut: boolean }>,
): Map<string, { score: number; missedCut: boolean }> {
  let worstMadeCut = -Infinity;
  for (const entry of allScores.values()) {
    if (!entry.missedCut && entry.score > worstMadeCut) {
      worstMadeCut = entry.score;
    }
  }
  if (worstMadeCut === -Infinity) return allScores;

  const result = new Map(allScores);
  for (const [id, entry] of result) {
    if (entry.missedCut) {
      result.set(id, { score: worstMadeCut, missedCut: true });
    }
  }
  return result;
}

function calculateTeamScore(
  playerScores: {
    playerId: string;
    playerName: string;
    score: number | null;
    missedCut: boolean;
  }[],
  scoringRule: ScoringRule,
): { scores: { playerId: string; counting: boolean; score: number | null; missedCut: boolean }[]; totalScore: number } {
  // Null (not started) counts as 0 (even par) for sorting and totals
  const sorted = [...playerScores].sort((a, b) => {
    const aScore = a.score ?? 0;
    const bScore = b.score ?? 0;
    return aScore - bScore;
  });

  const scores = sorted.map((ps, i) => ({
    playerId: ps.playerId,
    counting: i < scoringRule.countBest,
    score: ps.score,
    missedCut: ps.missedCut,
  }));

  const totalScore = scores
    .filter((r) => r.counting)
    .reduce((sum, r) => sum + (r.score ?? 0), 0);

  return { scores, totalScore };
}

// --- Data transforms ---

function extractRounds(p: MastersRawScorePlayer): MastersPlayerRound[] {
  return [p.round1, p.round2, p.round3, p.round4].map((r) => ({
    scores: r.scores,
    total: r.total,
    status: r.roundStatus,
  }));
}

function getCurrentRound(currentRoundStr: string): number {
  const n = parseInt(currentRoundStr, 10);
  if (isNaN(n) || n <= 0) return 1;
  return Math.ceil(n / 1000);
}

function buildLeaders(scorePlayers: MastersRawScorePlayer[]): MastersLeader[] {
  const sorted = [...scorePlayers]
    .filter((p) => p.active && p.status === "A")
    .sort((a, b) => {
      const aOrder = parseInt(a.sort_order?.split("|")[0] ?? "999", 10);
      const bOrder = parseInt(b.sort_order?.split("|")[0] ?? "999", 10);
      return aOrder - bOrder;
    })
    .slice(0, 10);

  return sorted.map((p) => ({
    pos: p.pos,
    name: p.last_name,
    countryCode: p.countryCode,
    score: p.topar,
    thru: p.thru || "—",
  }));
}

function buildHoles(rawHoles: MastersRawHole[]): MastersHoleInfo[] {
  return rawHoles.map((h) => ({
    number: parseInt(h.number, 10),
    name: h.plant,
    par: parseInt(h.par, 10),
    yardage: parseInt(h.yds, 10),
  }));
}

// --- Main builder ---

export function buildMastersLeaderboard(opts: {
  mastersYear: string;
  teams: TeamPick[];
  scoresData: MastersRawScoresData;
  mastersPlayers: MastersRawPlayer[];
  rawHoles: MastersRawHole[];
  scoringRule: ScoringRule;
  currentUserId?: string;
}): MastersLeaderboardResponse {
  const { mastersYear, teams, scoresData, mastersPlayers, rawHoles, scoringRule } =
    opts;

  const scorePlayers = scoresData.player;
  const currentRound = getCurrentRound(scoresData.currentRound);

  // Build score map for missed-cut penalty
  const scoreMap = new Map<string, { score: number; missedCut: boolean }>();
  for (const sp of scorePlayers) {
    const missedCut = sp.status === "C";
    const score = sp.topar === "E" ? 0 : parseInt(sp.topar, 10);
    if (!isNaN(score)) {
      scoreMap.set(sp.full_name, { score, missedCut });
    }
  }
  const adjustedScores = applyMissedCutPenalty(scoreMap);

  // Build leaderboard entries
  const leaderboard: MastersLeaderboardEntry[] = teams.map((team) => {
    const playerScores: MastersPlayerScore[] = team.picks.map((pick) => {
      const { scorePlayer, bioPlayer } = matchMastersPlayer(
        pick.name,
        scorePlayers,
        mastersPlayers,
      );

      const poolScore = scorePlayer
        ? adjustedScores.get(scorePlayer.full_name)
        : null;

      return {
        playerId: pick.id,
        playerName: pick.name,
        score: poolScore?.score ?? null,
        missedCut: poolScore?.missedCut ?? false,
        counting: false,
        mastersId: scorePlayer?.id ?? bioPlayer?.id ?? null,
        bio: bioPlayer
          ? {
              countryCode: bioPlayer.countryCode,
              age: bioPlayer.age,
              height: bioPlayer.height,
              swing: bioPlayer.swing,
              pastChampion: bioPlayer.past_champion,
              amateur: bioPlayer.amateur,
              firstMasters: bioPlayer.first_masters,
            }
          : scorePlayer
            ? {
                countryCode: scorePlayer.countryCode,
                age: "",
                height: "",
                swing: "",
                pastChampion: scorePlayer.past,
                amateur: scorePlayer.amateur,
                firstMasters: scorePlayer.firsttimer,
              }
            : null,
        pos: scorePlayer?.pos ?? null,
        today: scorePlayer?.today ?? null,
        thru: scorePlayer?.thru ?? null,
        currentHole: scorePlayer ? scorePlayer.holeProgress ?? null : null,
        rounds: scorePlayer ? extractRounds(scorePlayer) : [],
      };
    });

    // Best N of M scoring
    const { scores: scored, totalScore } = calculateTeamScore(
      playerScores.map((ps) => ({
        playerId: ps.playerId,
        playerName: ps.playerName,
        score: ps.score,
        missedCut: ps.missedCut,
      })),
      scoringRule,
    );

    const mergedScores = playerScores
      .map((ps) => {
        const scoredEntry = scored.find((s) => s.playerId === ps.playerId);
        return {
          ...ps,
          counting: scoredEntry?.counting ?? false,
          score: scoredEntry?.score ?? ps.score,
          missedCut: scoredEntry?.missedCut ?? ps.missedCut,
        };
      })
      .sort((a, b) => {
        // Counting players first, then sort by score ascending
        // Null (not yet started) sorts as 0 (even par) — better than any positive score
        if (a.counting !== b.counting) return a.counting ? -1 : 1;
        const aScore = a.score ?? 0;
        const bScore = b.score ?? 0;
        return aScore - bScore;
      });

    return {
      teamId: team.teamId,
      teamName: team.teamName,
      userId: team.userId,
      displayName: team.displayName,
      realName: team.realName,
      totalScore,
      playerScores: mergedScores,
    };
  });

  leaderboard.sort((a, b) => a.totalScore - b.totalScore);

  const roundPars = [
    scoresData.pars.round1,
    scoresData.pars.round2,
    scoresData.pars.round3,
    scoresData.pars.round4,
  ].filter((p) => p.length > 0);

  return {
    status:
      currentRound >= 4 && scoresData.statusRound.charAt(3) !== "N"
        ? "completed"
        : "active",
    mastersYear,
    currentRound,
    leaders: buildLeaders(scorePlayers),
    holes: rawHoles.length > 0 ? buildHoles(rawHoles) : [],
    roundPars:
      roundPars.length > 0
        ? roundPars
        : [[4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4]],
    leaderboard,
  };
}

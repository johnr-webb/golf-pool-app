import fetch from "node-fetch";
import { normalizeName } from "./espn";
import {
  applyMissedCutPenalty,
  calculateTeamScore,
} from "./leaderboard";
import type { ScoringRule } from "../types";
import type {
  MastersRawPlayer,
  MastersRawScoresData,
  MastersRawScorePlayer,
  MastersRawHole,
  MastersLeader,
  MastersHoleInfo,
  MastersPlayerRound,
  MastersPlayerScore,
  MastersLeaderboardEntry,
  MastersLeaderboardResponse,
} from "../types/masters";

const MASTERS_BASE = "https://www.masters.com/en_US";
const USER_AGENT = "Mozilla/5.0 (compatible; GolfPoolApp/1.0)";

// --- In-memory cache ---
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// --- Fetch functions ---

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Masters API returned ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchMastersScores(
  year: string,
): Promise<MastersRawScoresData> {
  const key = `masters-scores-${year}`;
  const cached = getCached<MastersRawScoresData>(key);
  if (cached) return cached;

  const raw = await fetchJson<{ data: MastersRawScoresData }>(
    `${MASTERS_BASE}/scores/feeds/${year}/scores.json`,
  );
  setCache(key, raw.data, 30_000); // 30s TTL
  return raw.data;
}

export async function fetchMastersPlayers(
  year: string,
): Promise<MastersRawPlayer[]> {
  const key = `masters-players-${year}`;
  const cached = getCached<MastersRawPlayer[]>(key);
  if (cached) return cached;

  const raw = await fetchJson<{ players: MastersRawPlayer[] }>(
    `${MASTERS_BASE}/cms/feeds/players/${year}/players.json`,
  );
  const players = raw.players.filter((p) => p.real_player);
  setCache(key, players, 3_600_000); // 1hr TTL
  return players;
}

export async function fetchMastersHoles(): Promise<MastersRawHole[]> {
  const key = "masters-holes";
  const cached = getCached<MastersRawHole[]>(key);
  if (cached) return cached;

  const raw = await fetchJson<{ holes: MastersRawHole[] }>(
    `${MASTERS_BASE}/json/man/course/angc/holes.json`,
  );
  setCache(key, raw.holes, 3_600_000); // 1hr TTL
  return raw.holes;
}

// --- Name matching ---

function matchMastersPlayer(
  playerName: string,
  mastersScorePlayers: MastersRawScorePlayer[],
  mastersPlayers: MastersRawPlayer[],
): { scorePlayer: MastersRawScorePlayer | null; bioPlayer: MastersRawPlayer | null } {
  const norm = normalizeName(playerName);

  const scorePlayer =
    mastersScorePlayers.find(
      (p) => normalizeName(p.full_name) === norm,
    ) ??
    mastersScorePlayers.find(
      (p) => normalizeName(p.last_name) === norm.split(" ").pop(),
    ) ??
    null;

  const bioPlayer =
    mastersPlayers.find((p) => normalizeName(p.name) === norm) ??
    mastersPlayers.find(
      (p) => normalizeName(p.last_name) === norm.split(" ").pop(),
    ) ??
    null;

  return { scorePlayer, bioPlayer };
}

// --- Build enriched response ---

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

function buildLeaders(
  scorePlayers: MastersRawScorePlayer[],
): MastersLeader[] {
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

export async function buildMastersLeaderboard(opts: {
  mastersYear: string;
  teams: { teamId: string; teamName: string; userId: string; picks: string[] }[];
  playerDocs: Map<string, { name: string; id: string }>;
  scoringRule: ScoringRule;
  requestUid: string;
}): Promise<MastersLeaderboardResponse> {
  const { mastersYear, teams, playerDocs, scoringRule } = opts;

  // Fetch all Masters data in parallel
  const [scoresData, mastersPlayers, rawHoles] = await Promise.all([
    fetchMastersScores(mastersYear),
    fetchMastersPlayers(mastersYear),
    fetchMastersHoles(),
  ]);

  const scorePlayers = scoresData.player;
  const currentRound = getCurrentRound(scoresData.currentRound);

  // Build score map for pool scoring: use topar as the total score
  const scoreMap = new Map<string, { score: number; missedCut: boolean }>();
  for (const sp of scorePlayers) {
    const missedCut = sp.status === "C";
    const score =
      sp.topar === "E" ? 0 : parseInt(sp.topar, 10);
    if (!isNaN(score)) {
      scoreMap.set(sp.full_name, { score, missedCut });
    }
  }

  // Apply missed-cut penalty using normalized names
  const adjustedScores = applyMissedCutPenalty(scoreMap);

  // Build leaderboard entries for each team
  const leaderboard: MastersLeaderboardEntry[] = teams.map((team) => {
    const playerScores: MastersPlayerScore[] = team.picks.map((pickId) => {
      const playerDoc = playerDocs.get(pickId);
      if (!playerDoc) {
        return {
          playerId: pickId,
          playerName: "Unknown",
          score: null,
          missedCut: false,
          counting: false,
          mastersId: null,
          bio: null,
          pos: null,
          today: null,
          thru: null,
          currentHole: null,
          rounds: [],
        };
      }

      const { scorePlayer, bioPlayer } = matchMastersPlayer(
        playerDoc.name,
        scorePlayers,
        mastersPlayers,
      );

      const poolScore = scorePlayer
        ? adjustedScores.get(scorePlayer.full_name)
        : null;

      return {
        playerId: pickId,
        playerName: playerDoc.name,
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
        currentHole: scorePlayer
          ? scorePlayer.holeProgress ?? null
          : null,
        rounds: scorePlayer ? extractRounds(scorePlayer) : [],
      };
    });

    // Apply pool scoring rules (best N of M)
    const scored = calculateTeamScore(
      playerScores.map((ps) => ({
        playerId: ps.playerId,
        playerName: ps.playerName,
        espnId: ps.mastersId,
        score: ps.score,
        missedCut: ps.missedCut,
      })),
      scoringRule,
    );

    // Merge counting flags back
    const mergedScores = playerScores.map((ps) => {
      const scoredEntry = scored.find((s) => s.playerId === ps.playerId);
      return {
        ...ps,
        counting: scoredEntry?.counting ?? false,
        score: scoredEntry?.score ?? ps.score,
        missedCut: scoredEntry?.missedCut ?? ps.missedCut,
      };
    });

    return {
      teamId: team.teamId,
      teamName: team.teamName,
      userId: team.userId,
      totalScore: scored.totalScore,
      playerScores: mergedScores,
    };
  });

  // Sort by total score ascending
  leaderboard.sort((a, b) => a.totalScore - b.totalScore);

  // Build round pars arrays
  const roundPars = [
    scoresData.pars.round1,
    scoresData.pars.round2,
    scoresData.pars.round3,
    scoresData.pars.round4,
  ].filter((p) => p.length > 0);

  return {
    status: currentRound >= 4 &&
      scoresData.statusRound.charAt(3) !== "N"
        ? "completed"
        : "active",
    mastersYear,
    currentRound,
    leaders: buildLeaders(scorePlayers),
    holes: buildHoles(rawHoles),
    roundPars: roundPars.length > 0 ? roundPars : [[4,5,4,3,4,3,4,5,4,4,4,3,5,4,5,3,4,4]],
    leaderboard,
  };
}

# Masters-Enhanced Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a premium Masters-specific leaderboard experience with dark theme, Augusta green/gold styling, tournament leaders ticker, country flags, and inline hole-by-hole scorecards — triggered by a `mastersYear` field on the tournament document.

**Architecture:** The existing leaderboard endpoint gains a Masters branch: when the tournament has `mastersYear`, it fetches from masters.com APIs (scores, players, holes) instead of ESPN, joins with pool team data, and returns an enriched response. The frontend detects `mastersYear` in the response and renders a new `MastersLeaderboard` component tree instead of the existing `LeaderboardActive`. All Masters code lives in `functions/src/services/masters.ts` (backend) and `web/components/masters/` + `web/lib/masters/` (frontend).

**Tech Stack:** TypeScript, Express (backend), Next.js 15 + React 19 + Mantine v7 (frontend), React Query for data fetching, CSS modules for Masters-specific styling.

**Spec:** `docs/superpowers/specs/2026-04-09-masters-leaderboard-design.md`

---

## File Map

### Backend (functions/)
| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/types/masters.ts` | Raw Masters API types + enriched response types |
| Modify | `src/types/index.ts` | Add `mastersYear?: string` to Tournament interface |
| Create | `src/services/masters.ts` | Fetch + cache masters.com data, build enriched response |
| Modify | `src/routes/pools.ts` | Branch leaderboard endpoint for Masters tournaments |

### Frontend (web/)
| Action | File | Responsibility |
|--------|------|---------------|
| Create | `lib/masters/types.ts` | Frontend wire types for Masters leaderboard response |
| Create | `lib/masters/flags.ts` | Country code → flag emoji conversion |
| Modify | `lib/types/api.ts` | Add Masters variant to LeaderboardResponse union |
| Create | `components/masters/masters.module.css` | All Masters-specific dark theme styles |
| Create | `components/masters/MastersScorecardCell.tsx` | Color-coded score cell (eagle/birdie/par/bogey) |
| Create | `components/masters/MastersScorecard.tsx` | Round tabs + front/back 9 grid |
| Create | `components/masters/MastersPlayerRow.tsx` | Collapsed/expanded player with scorecard |
| Create | `components/masters/MastersTeamCard.tsx` | Team card with player list |
| Create | `components/masters/MastersHero.tsx` | Green gradient banner |
| Create | `components/masters/MastersTicker.tsx` | Horizontal scrolling leaders strip |
| Create | `components/masters/MastersLeaderboard.tsx` | Page orchestrator |
| Modify | `components/leaderboard/Leaderboard.tsx` | Conditional render of Masters vs standard |

### Config
| Action | File | Responsibility |
|--------|------|---------------|
| Create | `web/.env.prod.template` | Template for pointing local FE to prod backend |

---

### Task 1: Backend Masters Types

**Files:**
- Create: `functions/src/types/masters.ts`
- Modify: `functions/src/types/index.ts`

- [ ] **Step 1: Create Masters type definitions**

Create `functions/src/types/masters.ts`:

```typescript
// Types for masters.com API responses and the enriched leaderboard response.

// --- Raw API types (from masters.com) ---

export interface MastersRawPlayer {
  id: string;
  first_name: string;
  last_name: string;
  name: string;           // "Scottie Scheffler"
  display_name: string;   // "S. Scheffler"
  countryCode: string;    // "USA"
  countryName: string;
  age: string;
  height: string;
  weight: string;
  swing: string;          // "Right" | "Left"
  past_champion: boolean;
  amateur: boolean;
  first_masters: boolean;
  real_player: boolean;
  dq: boolean;
  wd: boolean;
}

export interface MastersRawRound {
  prior: number | null;
  fantasy: number;
  total: number | null;
  roundStatus: string;    // "Playing" | "Pre" | "Complete"
  teetime: string;
  scores: (number | null)[];  // 18-element array, null = not played
}

export interface MastersRawScorePlayer {
  id: string;
  display_name: string;
  display_name2: string;
  first_name: string;
  last_name: string;
  full_name: string;
  countryCode: string;
  countryName: string;
  pos: string;            // "T1", "2", "CUT"
  amateur: boolean;
  past: boolean;          // past champion
  firsttimer: boolean;
  status: string;         // "A" = active, "C" = cut, "W" = withdrawn
  active: boolean;
  teetime: string;
  today: string;          // "E", "-3", "+1"
  thru: string;           // "F", "14", ""
  topar: string;          // "E", "-7", "+2"
  total: string;
  round1: MastersRawRound;
  round2: MastersRawRound;
  round3: MastersRawRound;
  round4: MastersRawRound;
}

export interface MastersRawScoresData {
  currentRound: string;   // "1000", "2000", etc. (round * 1000)
  statusRound: string;    // "PNNN" = round 1 playing, others not started
  wallClockTime: string;
  pars: {
    round1: number[];
    round2: number[];
    round3: number[];
    round4: number[];
  };
  yardages: {
    round1: number[];
    round2: number[];
    round3: number[];
    round4: number[];
  };
  player: MastersRawScorePlayer[];
}

export interface MastersRawHole {
  number: string;
  par: string;
  yds: string;
  plant: string;          // "Tea Olive"
  holeDesc: string;
  imageH: { src: string; width: string; height: string };
  eagles: string;
  birdies: string;
  pars: string;
  bogies: string;
  dblBogies: string;
}

// --- Enriched response types (sent to frontend) ---

export interface MastersLeader {
  pos: string;
  name: string;
  countryCode: string;
  score: string;          // topar: "E", "-7"
  thru: string;           // "F", "14"
}

export interface MastersHoleInfo {
  number: number;
  name: string;           // plant name
  par: number;
  yardage: number;
}

export interface MastersPlayerBio {
  countryCode: string;
  age: string;
  height: string;
  swing: string;
  pastChampion: boolean;
  amateur: boolean;
  firstMasters: boolean;
}

export interface MastersPlayerRound {
  scores: (number | null)[];  // 18 holes
  total: number | null;
  status: string;             // "Playing", "Pre", "Complete"
}

export interface MastersPlayerScore {
  playerId: string;
  playerName: string;
  score: number | null;
  missedCut: boolean;
  counting: boolean;
  // Masters enrichment
  mastersId: string | null;
  bio: MastersPlayerBio | null;
  pos: string | null;
  today: string | null;
  thru: string | null;
  currentHole: number | null;
  rounds: MastersPlayerRound[];
}

export interface MastersLeaderboardEntry {
  teamId: string;
  teamName: string;
  userId: string;
  totalScore: number;
  playerScores: MastersPlayerScore[];
}

export interface MastersLeaderboardResponse {
  status: "active" | "completed";
  mastersYear: string;
  currentRound: number;
  leaders: MastersLeader[];
  holes: MastersHoleInfo[];
  roundPars: number[][];      // pars per round (for scorecard display)
  leaderboard: MastersLeaderboardEntry[];
}
```

- [ ] **Step 2: Add mastersYear to Tournament type**

In `functions/src/types/index.ts`, add `mastersYear` to the Tournament interface:

```typescript
export interface Tournament {
  name: string;
  espnEventId: string | null;
  startDate: Timestamp;
  endDate: Timestamp;
  cutLine: number | null;
  status: "upcoming" | "active" | "completed";
  mastersYear?: string;  // e.g. "2026" — triggers Masters-specific leaderboard
  createdAt: Timestamp;
}
```

- [ ] **Step 3: Verify build**

Run: `cd functions && npm run build`
Expected: Clean compile, no errors.

- [ ] **Step 4: Commit**

```bash
git add functions/src/types/masters.ts functions/src/types/index.ts
git commit -m "feat: add Masters API types and mastersYear tournament field"
```

---

### Task 2: Backend Masters Service

**Files:**
- Create: `functions/src/services/masters.ts`

- [ ] **Step 1: Create the Masters data service**

Create `functions/src/services/masters.ts`:

```typescript
import fetch from "node-fetch";
import { normalizeName } from "./espn";
import {
  parseScore,
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
  MastersPlayerBio,
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

  // Match in scores data by full_name
  const scorePlayer =
    mastersScorePlayers.find(
      (p) => normalizeName(p.full_name) === norm,
    ) ??
    mastersScorePlayers.find(
      (p) => normalizeName(p.last_name) === norm.split(" ").pop(),
    ) ??
    null;

  // Match in player bios by name
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
  // Sort by sort_order (Masters provides this)
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
  // This replaces the ESPN score map
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

      // Get pool score from adjusted scores (using full_name as key)
      const poolScore = scorePlayer
        ? adjustedScores.get(scorePlayer.full_name)
        : null;

      return {
        playerId: pickId,
        playerName: playerDoc.name,
        score: poolScore?.score ?? null,
        missedCut: poolScore?.missedCut ?? false,
        counting: false, // set by calculateTeamScore below
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
```

- [ ] **Step 2: Verify build**

Run: `cd functions && npm run build`
Expected: Clean compile. Fix any type errors.

- [ ] **Step 3: Commit**

```bash
git add functions/src/services/masters.ts
git commit -m "feat: add Masters data service with caching and leaderboard builder"
```

---

### Task 3: Backend Leaderboard Integration

**Files:**
- Modify: `functions/src/routes/pools.ts`

- [ ] **Step 1: Add Masters branch to leaderboard endpoint**

In `functions/src/routes/pools.ts`, add the import at the top (after existing imports):

```typescript
import { buildMastersLeaderboard } from "../services/masters";
```

Then in the `GET /:poolId/leaderboard` handler, after fetching the tournament doc and before the ESPN fetch, add a Masters early-return branch. Insert this right after line 285 (`const tournament = tournDoc.data()!;`):

```typescript
    // Masters-specific path: use masters.com data instead of ESPN
    if (tournament.mastersYear) {
      const teamsSnap = await db
        .collection("teams")
        .where("poolId", "==", poolId)
        .get();

      if (teamsSnap.empty) {
        res.json({ status: "active", mastersYear: tournament.mastersYear, leaderboard: [], leaders: [], holes: [], roundPars: [], currentRound: 1 });
        return;
      }

      // Load all picked players
      const allPickIds = new Set<string>();
      const teamData = teamsSnap.docs.map((doc) => {
        const data = doc.data();
        const picks: string[] = data.picks || [];
        picks.forEach((id: string) => allPickIds.add(id));
        return {
          teamId: doc.id,
          teamName: data.name as string,
          userId: data.userId as string,
          picks,
        };
      });

      const playerDocSnaps = await Promise.all(
        [...allPickIds].map((id) => db.collection("players").doc(id).get()),
      );
      const playerDocs = new Map<string, { name: string; id: string }>();
      for (const snap of playerDocSnaps) {
        if (snap.exists) {
          playerDocs.set(snap.id, { name: snap.data()!.name, id: snap.id });
        }
      }

      try {
        const mastersResponse = await buildMastersLeaderboard({
          mastersYear: tournament.mastersYear,
          teams: teamData,
          playerDocs,
          scoringRule: pool.scoringRule,
          requestUid: req.uid!,
        });

        // Side-effect: sync tournament status
        const mastersStatus = mastersResponse.status;
        if (tournament.status !== mastersStatus) {
          tournDoc.ref
            .update({ status: mastersStatus })
            .catch((err: unknown) =>
              console.warn("[leaderboard] failed to sync tournament status:", err),
            );
        }

        res.json(mastersResponse);
        return;
      } catch (error) {
        logRouteError(
          "GET /pools/:poolId/leaderboard",
          req,
          "Masters data fetch failed, falling back to ESPN",
          error,
          { poolId, mastersYear: tournament.mastersYear },
        );
        // Fall through to ESPN path
      }
    }
```

- [ ] **Step 2: Verify build**

Run: `cd functions && npm run build`
Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add functions/src/routes/pools.ts
git commit -m "feat: branch leaderboard endpoint for Masters tournaments"
```

---

### Task 4: Frontend Types and Utilities

**Files:**
- Create: `web/lib/masters/types.ts`
- Create: `web/lib/masters/flags.ts`
- Modify: `web/lib/types/api.ts`

- [ ] **Step 1: Create frontend Masters types**

Create `web/lib/masters/types.ts`:

```typescript
export interface MastersLeader {
  pos: string;
  name: string;
  countryCode: string;
  score: string;
  thru: string;
}

export interface MastersHoleInfo {
  number: number;
  name: string;
  par: number;
  yardage: number;
}

export interface MastersPlayerBio {
  countryCode: string;
  age: string;
  height: string;
  swing: string;
  pastChampion: boolean;
  amateur: boolean;
  firstMasters: boolean;
}

export interface MastersPlayerRound {
  scores: (number | null)[];
  total: number | null;
  status: string;
}

export interface MastersPlayerScore {
  playerId: string;
  playerName: string;
  score: number | null;
  missedCut: boolean;
  counting: boolean;
  mastersId: string | null;
  bio: MastersPlayerBio | null;
  pos: string | null;
  today: string | null;
  thru: string | null;
  currentHole: number | null;
  rounds: MastersPlayerRound[];
}

export interface MastersLeaderboardEntry {
  teamId: string;
  teamName: string;
  userId: string;
  totalScore: number;
  playerScores: MastersPlayerScore[];
}

export interface MastersLeaderboardResponse {
  status: "active" | "completed";
  mastersYear: string;
  currentRound: number;
  leaders: MastersLeader[];
  holes: MastersHoleInfo[];
  roundPars: number[][];
  leaderboard: MastersLeaderboardEntry[];
}
```

- [ ] **Step 2: Create flag emoji utility**

Create `web/lib/masters/flags.ts`:

```typescript
/**
 * Convert a 3-letter country code to a flag emoji using regional indicator symbols.
 * Falls back to the code string if conversion fails.
 */

const CODE_TO_ISO2: Record<string, string> = {
  USA: "US", GBR: "GB", ENG: "GB", SCO: "GB", WAL: "GB", NIR: "GB",
  SWE: "SE", JPN: "JP", KOR: "KR", AUS: "AU", CAN: "CA", RSA: "ZA",
  ARG: "AR", ESP: "ES", FRA: "FR", GER: "DE", ITA: "IT", IRL: "IE",
  NOR: "NO", DEN: "DK", FIN: "FI", BEL: "BE", NED: "NL", AUT: "AT",
  CHN: "CN", IND: "IN", THA: "TH", TPE: "TW", COL: "CO", CHI: "CL",
  MEX: "MX", BRA: "BR", NZL: "NZ", PHI: "PH", PAR: "PY", VEN: "VE",
  PUR: "PR", ZIM: "ZW",
};

export function countryCodeToFlag(code: string): string {
  const iso2 = CODE_TO_ISO2[code.toUpperCase()] ?? code.slice(0, 2).toUpperCase();
  if (iso2.length !== 2) return code;
  const [a, b] = iso2.split("");
  return (
    String.fromCodePoint(0x1f1e6 + a.charCodeAt(0) - 65) +
    String.fromCodePoint(0x1f1e6 + b.charCodeAt(0) - 65)
  );
}
```

- [ ] **Step 3: Update frontend LeaderboardResponse type**

In `web/lib/types/api.ts`, update the `LeaderboardResponse` type to include the Masters variant. Add this import at the top:

```typescript
import type { MastersLeaderboardResponse } from "@/lib/masters/types";
```

Then change the `LeaderboardResponse` type:

```typescript
export type LeaderboardResponse =
  | { status: "upcoming"; teams: UpcomingTeam[] }
  | {
      status: "active" | "completed";
      leaderboard: LeaderboardEntry[];
    }
  | MastersLeaderboardResponse;
```

- [ ] **Step 4: Verify typecheck**

Run: `cd web && npm run typecheck`
Expected: Passes.

- [ ] **Step 5: Commit**

```bash
git add web/lib/masters/types.ts web/lib/masters/flags.ts web/lib/types/api.ts
git commit -m "feat: add frontend Masters types and flag emoji utility"
```

---

### Task 5: Masters CSS Module

**Files:**
- Create: `web/components/masters/masters.module.css`

- [ ] **Step 1: Create the shared Masters stylesheet**

Create `web/components/masters/masters.module.css`:

```css
/* Masters dark theme — Augusta green and gold */

.page {
  background: #141414;
  min-height: 100vh;
}

/* Hero banner */
.hero {
  background: linear-gradient(135deg, #0a3d0a 0%, #14501a 50%, #0a3d0a 100%);
  padding: 16px 20px 14px;
  color: #fff;
  text-align: center;
}

.heroSubtitle {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 4px;
  color: #d4af37;
  margin-bottom: 4px;
}

.heroTitle {
  font-size: 22px;
  font-weight: 300;
  letter-spacing: 1px;
  margin-bottom: 2px;
}

.heroRound {
  font-size: 11px;
  color: #8fbc8f;
}

.heroStats {
  margin-top: 12px;
  display: flex;
  justify-content: center;
  gap: 20px;
  font-size: 11px;
}

.heroStatLabel {
  color: #d4af37;
  font-size: 9px;
  text-transform: uppercase;
  display: block;
}

/* Ticker */
.ticker {
  background: #0d2e0d;
  border-top: 1px solid rgba(212, 175, 55, 0.2);
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
  padding: 8px 0;
  overflow: hidden;
}

.tickerScroll {
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding: 0 12px;
  gap: 6px;
  scrollbar-width: none;
}

.tickerScroll::-webkit-scrollbar {
  display: none;
}

.tickerBadge {
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #d4af37;
  white-space: nowrap;
  font-weight: 700;
  padding: 4px 8px;
  background: rgba(212, 175, 55, 0.15);
  border-radius: 4px;
  flex-shrink: 0;
}

.tickerChip {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 5px 10px;
  white-space: nowrap;
  flex-shrink: 0;
}

.tickerPos {
  font-size: 10px;
  font-weight: 800;
}

.tickerFlag {
  font-size: 13px;
}

.tickerName {
  color: #eee;
  font-size: 11px;
  font-weight: 600;
}

.tickerScore {
  color: #4ade80;
  font-size: 11px;
  font-weight: 700;
}

.tickerThru {
  color: #555;
  font-size: 9px;
}

/* Pool standings section */
.standings {
  padding: 12px;
}

.standingsHeader {
  font-size: 11px;
  font-weight: 700;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.liveBadge {
  background: #22c55e;
  color: #fff;
  font-size: 8px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Team card */
.teamCard {
  background: #1e1e1e;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 10px;
  border-left: 4px solid #555;
}

.teamCard[data-rank="1"] { border-left-color: #d4af37; }
.teamCard[data-rank="2"] { border-left-color: #C0C0C0; }
.teamCard[data-rank="3"] { border-left-color: #cd7f32; }

.teamHeader {
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.teamRank {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: #000;
  flex-shrink: 0;
}

.teamName {
  font-weight: 700;
  font-size: 14px;
  color: #eee;
}

.teamScore {
  font-size: 22px;
  font-weight: 800;
  color: #4ade80;
}

/* Player row */
.playerRow {
  padding: 9px 14px;
  border-top: 1px solid #2a2a2a;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.playerFlag {
  font-size: 15px;
  flex-shrink: 0;
}

.playerInfo {
  flex: 1;
  min-width: 0;
}

.playerName {
  font-weight: 600;
  font-size: 12px;
  color: #ddd;
}

.playerHole {
  font-size: 9px;
  color: #666;
}

.playerHoleName {
  color: #4ade80;
}

.playerScoreBlock {
  text-align: right;
  flex-shrink: 0;
}

.playerTotal {
  font-weight: 700;
  font-size: 13px;
  color: #4ade80;
}

.playerToday {
  font-size: 9px;
  color: #666;
}

.playerChevron {
  color: #444;
  font-size: 10px;
  flex-shrink: 0;
  transition: transform 0.2s;
}

.playerChevronOpen {
  transform: rotate(180deg);
}

/* Expanded player header */
.expandedHeader {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, #0a3d0a, #1a5c1a);
  color: #fff;
  border-top: 2px solid #0a3d0a;
}

.expandedFlag {
  font-size: 24px;
  flex-shrink: 0;
}

.expandedName {
  font-weight: 700;
  font-size: 14px;
}

.expandedBio {
  font-size: 10px;
  color: #8fbc8f;
}

.championBadge {
  color: #d4af37;
  font-weight: 600;
}

.expandedScoreBlock {
  text-align: right;
  flex-shrink: 0;
}

.expandedTotal {
  font-size: 20px;
  font-weight: 800;
  color: #4ade80;
}

.expandedPos {
  font-size: 9px;
  color: #8fbc8f;
}

/* Scorecard */
.scorecard {
  padding: 8px 10px;
  background: #1a2a1a;
}

.roundTabs {
  display: flex;
  gap: 2px;
  margin-bottom: 8px;
}

.roundTab {
  font-size: 10px;
  color: #555;
  padding: 3px 10px;
  border-radius: 12px;
  cursor: pointer;
  border: none;
  background: none;
}

.roundTabActive {
  font-weight: 700;
  color: #fff;
  background: #0a3d0a;
}

.scorecardTable {
  width: 100%;
  font-size: 10px;
  border-collapse: collapse;
  text-align: center;
}

.scorecardTable td {
  padding: 2px 1px;
}

.holeNumberRow td {
  color: #555;
  font-size: 8px;
}

.scoreRow td {
  font-weight: 700;
  font-size: 12px;
  color: #ddd;
}

.outInLabel {
  color: #888 !important;
  font-weight: 700 !important;
  font-size: 9px !important;
}

.outInTotal {
  font-weight: 800 !important;
  font-size: 12px !important;
  color: #eee !important;
}

/* Score cells */
.cellBirdie {
  background: #22c55e;
  color: #fff;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.cellEagle {
  background: #d4af37;
  color: #fff;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.5);
}

.cellBogey {
  background: #dc2626;
  color: #fff;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.cellDoubleBogey {
  background: #991b1b;
  color: #fff;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.cellUnplayed {
  color: #333;
}

.legend {
  margin-top: 8px;
  display: flex;
  gap: 10px;
  font-size: 8px;
  color: #666;
  justify-content: center;
}

.legendDot {
  width: 12px;
  height: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 7px;
}

/* Non-counting player styling */
.nonCounting {
  opacity: 0.5;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/masters/masters.module.css
git commit -m "feat: add Masters dark theme CSS module"
```

---

### Task 6: MastersScorecardCell Component

**Files:**
- Create: `web/components/masters/MastersScorecardCell.tsx`

- [ ] **Step 1: Create the color-coded score cell**

Create `web/components/masters/MastersScorecardCell.tsx`:

```tsx
"use client";

import styles from "./masters.module.css";

interface Props {
  score: number | null;
  par: number;
}

export function MastersScorecardCell({ score, par }: Props) {
  if (score === null) {
    return <span className={styles.cellUnplayed}>·</span>;
  }

  const diff = score - par;

  if (diff <= -2) {
    return <span className={styles.cellEagle}>{score}</span>;
  }
  if (diff === -1) {
    return <span className={styles.cellBirdie}>{score}</span>;
  }
  if (diff === 1) {
    return <span className={styles.cellBogey}>{score}</span>;
  }
  if (diff >= 2) {
    return <span className={styles.cellDoubleBogey}>{score}</span>;
  }

  // Par
  return <span>{score}</span>;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/masters/MastersScorecardCell.tsx
git commit -m "feat: add color-coded scorecard cell component"
```

---

### Task 7: MastersScorecard Component

**Files:**
- Create: `web/components/masters/MastersScorecard.tsx`

- [ ] **Step 1: Create the scorecard with round tabs and front/back nine**

Create `web/components/masters/MastersScorecard.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { MastersPlayerRound } from "@/lib/masters/types";
import { MastersScorecardCell } from "./MastersScorecardCell";
import styles from "./masters.module.css";

interface Props {
  rounds: MastersPlayerRound[];
  roundPars: number[][];
  currentRound: number;
}

export function MastersScorecard({ rounds, roundPars, currentRound }: Props) {
  const [selectedRound, setSelectedRound] = useState(currentRound - 1);

  const round = rounds[selectedRound];
  const pars = roundPars[selectedRound] ?? roundPars[0] ?? [];

  if (!round || pars.length === 0) {
    return null;
  }

  const front = round.scores.slice(0, 9);
  const back = round.scores.slice(9, 18);
  const frontPars = pars.slice(0, 9);
  const backPars = pars.slice(9, 18);

  const frontTotal = front.reduce((s, v) => s + (v ?? 0), 0);
  const backTotal = back.reduce((s, v) => s + (v ?? 0), 0);
  const frontPlayed = front.some((v) => v !== null);
  const backPlayed = back.some((v) => v !== null);

  return (
    <div className={styles.scorecard}>
      <div className={styles.roundTabs}>
        {rounds.map((r, i) => (
          <button
            key={i}
            className={`${styles.roundTab} ${i === selectedRound ? styles.roundTabActive : ""}`}
            onClick={() => setSelectedRound(i)}
          >
            R{i + 1}
          </button>
        ))}
      </div>

      {/* Front 9 */}
      <div style={{ overflowX: "auto" }}>
        <table className={styles.scorecardTable}>
          <tbody>
            <tr className={styles.holeNumberRow}>
              <td style={{ width: 8 }} />
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((h) => (
                <td key={h}>{h}</td>
              ))}
              <td className={styles.outInLabel}>OUT</td>
            </tr>
            <tr className={styles.scoreRow}>
              <td />
              {front.map((score, i) => (
                <td key={i}>
                  <MastersScorecardCell score={score} par={frontPars[i]} />
                </td>
              ))}
              <td className={styles.outInTotal}>
                {frontPlayed ? frontTotal : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Back 9 */}
        <table className={styles.scorecardTable} style={{ marginTop: 4 }}>
          <tbody>
            <tr className={styles.holeNumberRow}>
              <td style={{ width: 8 }} />
              {[10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => (
                <td key={h}>{h}</td>
              ))}
              <td className={styles.outInLabel}>IN</td>
            </tr>
            <tr className={styles.scoreRow}>
              <td />
              {back.map((score, i) => (
                <td key={i}>
                  <MastersScorecardCell score={score} par={backPars[i]} />
                </td>
              ))}
              <td className={styles.outInTotal}>
                {backPlayed ? backTotal : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.legend}>
        <span>
          <span className={`${styles.legendDot} ${styles.cellEagle}`}>·</span>{" "}
          Eagle
        </span>
        <span>
          <span className={`${styles.legendDot} ${styles.cellBirdie}`}>·</span>{" "}
          Birdie
        </span>
        <span>
          <span className={`${styles.legendDot} ${styles.cellBogey}`}>·</span>{" "}
          Bogey+
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/masters/MastersScorecard.tsx
git commit -m "feat: add Masters scorecard with round tabs and color-coded grid"
```

---

### Task 8: MastersPlayerRow Component

**Files:**
- Create: `web/components/masters/MastersPlayerRow.tsx`

- [ ] **Step 1: Create the collapsible player row**

Create `web/components/masters/MastersPlayerRow.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { MastersPlayerScore, MastersHoleInfo } from "@/lib/masters/types";
import { countryCodeToFlag } from "@/lib/masters/flags";
import { MastersScorecard } from "./MastersScorecard";
import styles from "./masters.module.css";

interface Props {
  player: MastersPlayerScore;
  holes: MastersHoleInfo[];
  roundPars: number[][];
  currentRound: number;
}

export function MastersPlayerRow({ player, holes, roundPars, currentRound }: Props) {
  const [expanded, setExpanded] = useState(false);

  const flag = player.bio ? countryCodeToFlag(player.bio.countryCode) : "";
  const currentHoleInfo =
    player.currentHole && player.currentHole <= holes.length
      ? holes[player.currentHole - 1]
      : null;

  const scoreColor = (player.score ?? 0) < 0 ? "#4ade80" : (player.score ?? 0) > 0 ? "#dc2626" : "#ddd";
  const formatScore = (s: number | null) =>
    s === null ? "—" : s === 0 ? "E" : s > 0 ? `+${s}` : `${s}`;

  if (expanded) {
    return (
      <div>
        <div className={styles.expandedHeader} onClick={() => setExpanded(false)}>
          <span className={styles.expandedFlag}>{flag}</span>
          <div style={{ flex: 1 }}>
            <div className={styles.expandedName}>{player.playerName}</div>
            <div className={styles.expandedBio}>
              {player.bio && (
                <>
                  {player.bio.age && `${player.bio.age}`}
                  {player.bio.height && ` · ${player.bio.height}`}
                  {player.bio.pastChampion && (
                    <span className={styles.championBadge}> · 🏆 Past Champion</span>
                  )}
                  {player.bio.amateur && " · Amateur"}
                  {player.bio.firstMasters && " · First Masters"}
                </>
              )}
            </div>
          </div>
          <div className={styles.expandedScoreBlock}>
            <div className={styles.expandedTotal} style={{ color: scoreColor }}>
              {formatScore(player.score)}
            </div>
            <div className={styles.expandedPos}>
              {player.pos ?? ""} · Today {player.today ?? "—"}
            </div>
          </div>
        </div>
        {player.rounds.length > 0 && (
          <MastersScorecard
            rounds={player.rounds}
            roundPars={roundPars}
            currentRound={currentRound}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`${styles.playerRow} ${!player.counting ? styles.nonCounting : ""}`}
      onClick={() => setExpanded(true)}
    >
      <span className={styles.playerFlag}>{flag}</span>
      <div className={styles.playerInfo}>
        <div className={styles.playerName}>{player.playerName}</div>
        <div className={styles.playerHole}>
          {currentHoleInfo ? (
            <>
              Hole {currentHoleInfo.number} ·{" "}
              <span className={styles.playerHoleName}>
                {currentHoleInfo.name}, Par {currentHoleInfo.par}
              </span>
            </>
          ) : player.thru === "F" ? (
            "Finished"
          ) : player.thru ? (
            `Thru ${player.thru}`
          ) : (
            ""
          )}
        </div>
      </div>
      <div className={styles.playerScoreBlock}>
        <div className={styles.playerTotal} style={{ color: scoreColor }}>
          {formatScore(player.score)}
        </div>
        <div className={styles.playerToday}>Today {player.today ?? "—"}</div>
      </div>
      <span className={styles.playerChevron}>▼</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/masters/MastersPlayerRow.tsx
git commit -m "feat: add collapsible Masters player row with scorecard"
```

---

### Task 9: MastersTeamCard Component

**Files:**
- Create: `web/components/masters/MastersTeamCard.tsx`

- [ ] **Step 1: Create the expandable team card**

Create `web/components/masters/MastersTeamCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { MastersLeaderboardEntry, MastersHoleInfo } from "@/lib/masters/types";
import { formatScore } from "@/lib/utils/format";
import { MastersPlayerRow } from "./MastersPlayerRow";
import styles from "./masters.module.css";

const RANK_COLORS: Record<number, string> = {
  1: "#d4af37",
  2: "#C0C0C0",
  3: "#cd7f32",
};

interface Props {
  entry: MastersLeaderboardEntry;
  rank: number;
  holes: MastersHoleInfo[];
  roundPars: number[][];
  currentRound: number;
}

export function MastersTeamCard({ entry, rank, holes, roundPars, currentRound }: Props) {
  const [expanded, setExpanded] = useState(false);

  const rankColor = RANK_COLORS[rank] ?? "#555";

  return (
    <div className={styles.teamCard} data-rank={rank <= 3 ? rank : undefined}>
      <div className={styles.teamHeader} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className={styles.teamRank} style={{ background: rankColor }}>
            {rank}
          </div>
          <span className={styles.teamName}>{entry.teamName}</span>
        </div>
        <div className={styles.teamScore}>{formatScore(entry.totalScore)}</div>
      </div>
      {expanded &&
        entry.playerScores.map((player) => (
          <MastersPlayerRow
            key={player.playerId}
            player={player}
            holes={holes}
            roundPars={roundPars}
            currentRound={currentRound}
          />
        ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/masters/MastersTeamCard.tsx
git commit -m "feat: add expandable Masters team card component"
```

---

### Task 10: MastersHero and MastersTicker Components

**Files:**
- Create: `web/components/masters/MastersHero.tsx`
- Create: `web/components/masters/MastersTicker.tsx`

- [ ] **Step 1: Create the hero banner**

Create `web/components/masters/MastersHero.tsx`:

```tsx
"use client";

import { formatScore } from "@/lib/utils/format";
import styles from "./masters.module.css";

interface Props {
  currentRound: number;
  status: "active" | "completed";
  myTeamRank: number | null;
  myTeamScore: number | null;
  fieldSize: number;
}

export function MastersHero({ currentRound, status, myTeamRank, myTeamScore, fieldSize }: Props) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroSubtitle}>Augusta National Golf Club</div>
      <div className={styles.heroTitle}>The Masters</div>
      <div className={styles.heroRound}>
        {status === "completed"
          ? "Final Results"
          : `Round ${currentRound} · April 2026`}
      </div>
      <div className={styles.heroStats}>
        {myTeamRank !== null && (
          <div>
            <span className={styles.heroStatLabel}>Your Team</span>
            <span style={{ fontWeight: 700 }}>
              {myTeamRank === 1 ? "1st" : myTeamRank === 2 ? "2nd" : myTeamRank === 3 ? "3rd" : `${myTeamRank}th`}
            </span>{" "}
            <span style={{ color: "#4ade80" }}>({formatScore(myTeamScore)})</span>
          </div>
        )}
        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: 20 }}>
          <span className={styles.heroStatLabel}>Field</span>
          {fieldSize} players
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the tournament leaders ticker**

Create `web/components/masters/MastersTicker.tsx`:

```tsx
"use client";

import type { MastersLeader } from "@/lib/masters/types";
import { countryCodeToFlag } from "@/lib/masters/flags";
import styles from "./masters.module.css";

const POS_COLORS: Record<string, string> = {
  "1": "#d4af37",
  "2": "#C0C0C0",
  "3": "#cd7f32",
};

interface Props {
  leaders: MastersLeader[];
}

export function MastersTicker({ leaders }: Props) {
  if (leaders.length === 0) return null;

  return (
    <div className={styles.ticker}>
      <div className={styles.tickerScroll}>
        <div className={styles.tickerBadge}>Leaders</div>
        {leaders.map((leader, i) => {
          const posColor = POS_COLORS[leader.pos.replace("T", "")] ?? "#888";
          return (
            <div key={i} className={styles.tickerChip}>
              <span className={styles.tickerPos} style={{ color: posColor }}>
                {leader.pos}
              </span>
              <span className={styles.tickerFlag}>
                {countryCodeToFlag(leader.countryCode)}
              </span>
              <span className={styles.tickerName}>{leader.name}</span>
              <span className={styles.tickerScore}>{leader.score}</span>
              <span className={styles.tickerThru}>{leader.thru}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/masters/MastersHero.tsx web/components/masters/MastersTicker.tsx
git commit -m "feat: add Masters hero banner and tournament leaders ticker"
```

---

### Task 11: MastersLeaderboard Orchestrator

**Files:**
- Create: `web/components/masters/MastersLeaderboard.tsx`

- [ ] **Step 1: Create the page orchestrator**

Create `web/components/masters/MastersLeaderboard.tsx`:

```tsx
"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import type { MastersLeaderboardResponse } from "@/lib/masters/types";
import { MastersHero } from "./MastersHero";
import { MastersTicker } from "./MastersTicker";
import { MastersTeamCard } from "./MastersTeamCard";
import styles from "./masters.module.css";

interface Props {
  data: MastersLeaderboardResponse;
}

export function MastersLeaderboard({ data }: Props) {
  const { user } = useAuth();

  // Find the current user's team rank
  const myTeamIndex = data.leaderboard.findIndex(
    (entry) => entry.userId === user?.uid,
  );
  const myTeamRank = myTeamIndex >= 0 ? myTeamIndex + 1 : null;
  const myTeamScore =
    myTeamIndex >= 0 ? data.leaderboard[myTeamIndex].totalScore : null;

  // Count unique players across all teams for field size
  const uniquePlayers = new Set<string>();
  for (const entry of data.leaderboard) {
    for (const ps of entry.playerScores) {
      if (ps.mastersId) uniquePlayers.add(ps.mastersId);
    }
  }

  return (
    <div className={styles.page}>
      <MastersHero
        currentRound={data.currentRound}
        status={data.status}
        myTeamRank={myTeamRank}
        myTeamScore={myTeamScore}
        fieldSize={data.leaders.length > 0 ? 91 : uniquePlayers.size}
      />

      <MastersTicker leaders={data.leaders} />

      <div className={styles.standings}>
        <div className={styles.standingsHeader}>
          Pool Standings
          <span className={styles.liveBadge}>
            {data.status === "active" ? "Live" : "Final"}
          </span>
        </div>
        {data.leaderboard.map((entry, idx) => (
          <MastersTeamCard
            key={entry.teamId}
            entry={entry}
            rank={idx + 1}
            holes={data.holes}
            roundPars={data.roundPars}
            currentRound={data.currentRound}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd web && npm run typecheck`
Expected: Passes. If there are import issues with `useAuth`, check the actual export name in `web/lib/auth/AuthProvider.tsx`.

- [ ] **Step 3: Commit**

```bash
git add web/components/masters/MastersLeaderboard.tsx
git commit -m "feat: add Masters leaderboard page orchestrator"
```

---

### Task 12: Wire Masters Into Existing Leaderboard

**Files:**
- Modify: `web/components/leaderboard/Leaderboard.tsx`

- [ ] **Step 1: Add conditional Masters rendering**

Replace the contents of `web/components/leaderboard/Leaderboard.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/api/pools";
import { LeaderboardUpcoming } from "./LeaderboardUpcoming";
import { LeaderboardActive } from "./LeaderboardActive";
import { MastersLeaderboard } from "@/components/masters/MastersLeaderboard";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingCard } from "@/components/common/LoadingCard";
import type { MastersLeaderboardResponse } from "@/lib/masters/types";

function isMastersResponse(data: unknown): data is MastersLeaderboardResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "mastersYear" in data &&
    typeof (data as Record<string, unknown>).mastersYear === "string"
  );
}

export function Leaderboard({ poolId }: { poolId: string }) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["pools", poolId, "leaderboard"],
    queryFn: () => getLeaderboard(poolId),
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });

  if (error) {
    return (
      <ErrorAlert
        message={
          error instanceof Error ? error.message : "Failed to load leaderboard"
        }
      />
    );
  }
  if (!data && isLoading) return <LoadingCard />;
  if (!data) return null;

  // Masters-specific rendering
  if (isMastersResponse(data)) {
    return <MastersLeaderboard data={data} />;
  }

  if (data.status === "upcoming") {
    return <LeaderboardUpcoming teams={data.teams} />;
  }
  return <LeaderboardActive entries={data.leaderboard} status={data.status} />;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd web && npm run typecheck`
Expected: Passes.

- [ ] **Step 3: Commit**

```bash
git add web/components/leaderboard/Leaderboard.tsx
git commit -m "feat: wire Masters leaderboard into existing routing"
```

---

### Task 13: Prod Backend Switch

**Files:**
- Create: `web/.env.prod.template`

- [ ] **Step 1: Create the prod env template**

Create `web/.env.prod.template`:

```bash
# Point local Next.js dev server at the DEPLOYED Firebase backend.
# Usage: cp .env.prod.template .env.local && npm run dev
#
# Fill in real Firebase config values below.
# Get them from: firebase apps:sdkconfig web
NEXT_PUBLIC_API_BASE_URL=/api
INTERNAL_API_URL=https://us-central1-golf-pool-app-492300.cloudfunctions.net/api

NEXT_PUBLIC_FIREBASE_API_KEY=__FILL_IN__
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=golf-pool-app-492300.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=golf-pool-app-492300
NEXT_PUBLIC_FIREBASE_APP_ID=__FILL_IN__
NEXT_PUBLIC_USE_EMULATORS=false
```

- [ ] **Step 2: Commit**

```bash
git add web/.env.prod.template
git commit -m "feat: add prod backend env template"
```

---

### Task 14: Verify End-to-End

- [ ] **Step 1: Build backend**

Run: `cd functions && npm run build`
Expected: Clean compile, no errors.

- [ ] **Step 2: Build frontend**

Run: `cd web && npm run build`
Expected: Clean compile, no errors.

- [ ] **Step 3: Typecheck frontend**

Run: `cd web && npm run typecheck`
Expected: Passes.

- [ ] **Step 4: Check auth import**

Verify the `useAuth` hook exists and exports correctly:

Run: `grep -n "export.*useAuth" web/lib/auth/AuthProvider.tsx`

If it exports as a named export, the import in `MastersLeaderboard.tsx` is correct. If it's a default export or uses a different name, update the import.

- [ ] **Step 5: Manual verification checklist**

Once running with `firebase emulators:start` + `cd web && npm run dev`:

1. Create a tournament with `mastersYear: "2026"` in Firestore
2. Create a pool linked to that tournament
3. Add players and create a team
4. Navigate to the pool page
5. Verify: Masters hero banner renders with green gradient
6. Verify: Tournament leaders ticker shows with flags and scores
7. Verify: Team cards show in dark theme with gold/silver/bronze borders
8. Verify: Expand a team → player rows show flags, current hole, scores
9. Verify: Expand a player → scorecard shows hole-by-hole with color coding
10. Verify: Round tabs switch between R1-R4
11. Verify: Mobile viewport (375px) — no overflow, scrollable scorecard
12. Verify: Non-Masters pool → existing leaderboard renders unchanged

import fetch from "node-fetch";
import * as fs from "fs";
import * as path from "path";
import { EspnCompetitor } from "../types";

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard";

// Default path to the committed sample scoreboard dump (Valero Texas Open,
// event 401811940). Override with ESPN_FIXTURE_PATH env var if needed. Path
// is relative to process.cwd() which is `functions/` when running under the
// emulator via `firebase emulators:start`.
const DEFAULT_FIXTURE_PATH = "../plan/sample_data.json";

/**
 * When running under the functions emulator, read scoreboard data from the
 * local sample_data.json fixture instead of calling the live ESPN API. This
 * lets the dev environment render a real, populated leaderboard without
 * network access or flaky upstream responses.
 *
 * Gated on FUNCTIONS_EMULATOR=true so production deploys always hit the real
 * ESPN API, regardless of what the fallback path resolves to.
 */
function loadFixtureCompetitors(): EspnCompetitor[] | null {
  if (process.env.FUNCTIONS_EMULATOR !== "true") return null;
  const fixturePath = process.env.ESPN_FIXTURE_PATH ?? DEFAULT_FIXTURE_PATH;

  const resolved = path.isAbsolute(fixturePath)
    ? fixturePath
    : path.resolve(process.cwd(), fixturePath);

  try {
    const raw = fs.readFileSync(resolved, "utf8");
    // sample_data.json has a few trailing commas; strip them before parsing.
    const cleaned = raw.replace(/,(\s*[}\]])/g, "$1");
    const data = JSON.parse(cleaned) as Record<string, unknown>;
    const events = data.events as Array<Record<string, unknown>> | undefined;
    if (!events || events.length === 0) return [];
    const competitions =
      (events[0].competitions as Array<Record<string, unknown>>) || [];
    if (competitions.length === 0) return [];
    return (competitions[0].competitors as EspnCompetitor[]) || [];
  } catch (err) {
    console.warn(
      `[espn] ESPN_FIXTURE_PATH set but could not load ${resolved}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function fetchScoreboard(): Promise<EspnCompetitor[]> {
  const fixture = loadFixtureCompetitors();
  if (fixture !== null) return fixture;

  const res = await fetch(SCOREBOARD_URL);
  if (!res.ok) {
    throw new Error(`ESPN API returned ${res.status}`);
  }
  const data = await res.json() as Record<string, unknown>;
  const events = data.events as Array<Record<string, unknown>> | undefined;
  if (!events || events.length === 0) {
    return [];
  }
  const competitions = (events[0].competitions as Array<Record<string, unknown>>) || [];
  if (competitions.length === 0) {
    return [];
  }
  return (competitions[0].competitors as EspnCompetitor[]) || [];
}

export async function fetchScoreboardForEvent(
  espnEventId: string
): Promise<EspnCompetitor[]> {
  const fixture = loadFixtureCompetitors();
  if (fixture !== null) return fixture;

  const res = await fetch(`${SCOREBOARD_URL}?event=${espnEventId}`);
  if (!res.ok) {
    throw new Error(`ESPN API returned ${res.status}`);
  }
  const data = await res.json() as Record<string, unknown>;
  const events = data.events as Array<Record<string, unknown>> | undefined;
  if (!events || events.length === 0) {
    return [];
  }
  const competitions = (events[0].competitions as Array<Record<string, unknown>>) || [];
  if (competitions.length === 0) {
    return [];
  }
  return (competitions[0].competitors as EspnCompetitor[]) || [];
}

/**
 * Normalize a name for fuzzy matching:
 * lowercase, strip accents, collapse whitespace
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Collapse initials, punctuation, and spacing so "J. J. Spaun" and "JJ Spaun"
 * both become "jj spaun", and "Christopher" shortened forms match better.
 */
function compactName(name: string): string {
  return normalizeName(name).replace(/\.\s*/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Extract the last token as surname for fallback matching.
 * "Scottie Scheffler" → "scheffler"
 */
function lastName(name: string): string {
  const parts = normalizeName(name).split(" ");
  return parts[parts.length - 1];
}

/**
 * Match our players to ESPN competitors by name.
 *
 * Matching cascade:
 * 1. Exact fullName match
 * 2. Normalized (accent-stripped, lowercased) fullName / displayName
 * 3. Compacted names (strips dots/extra spaces — handles "J. J." vs "JJ")
 * 4. Last-name match (only if it's unique among ESPN competitors)
 *
 * Returns { matched, unmatched } arrays.
 */
export function matchPlayers(
  ourPlayers: { id: string; name: string }[],
  espnCompetitors: EspnCompetitor[]
): {
  matched: { playerId: string; espnId: string; espnName: string }[];
  unmatched: { playerId: string; name: string }[];
} {
  const matched: { playerId: string; espnId: string; espnName: string }[] = [];
  const unmatched: { playerId: string; name: string }[] = [];

  // Pre-compute a last-name → competitor index for fallback matching.
  // Only include last names that are unique among ESPN competitors.
  const lastNameIndex = new Map<string, EspnCompetitor | null>();
  for (const c of espnCompetitors) {
    const ln = lastName(c.athlete.fullName);
    lastNameIndex.set(ln, lastNameIndex.has(ln) ? null : c);
  }

  for (const player of ourPlayers) {
    const normalizedOurs = normalizeName(player.name);
    const compactOurs = compactName(player.name);

    // 1. Exact match on fullName
    let found = espnCompetitors.find(
      (c) => c.athlete.fullName === player.name
    );

    // 2. Normalized match on fullName or displayName
    if (!found) {
      found = espnCompetitors.find(
        (c) => normalizeName(c.athlete.fullName) === normalizedOurs
      );
    }
    if (!found) {
      found = espnCompetitors.find(
        (c) => normalizeName(c.athlete.displayName) === normalizedOurs
      );
    }

    // 3. Compacted match (handles "J. J." vs "JJ", dots, extra spaces)
    if (!found) {
      found = espnCompetitors.find(
        (c) => compactName(c.athlete.fullName) === compactOurs
      );
    }
    if (!found) {
      found = espnCompetitors.find(
        (c) => compactName(c.athlete.displayName) === compactOurs
      );
    }

    // 4. Unique last-name fallback
    if (!found) {
      const ln = lastName(player.name);
      const candidate = lastNameIndex.get(ln);
      if (candidate) {
        found = candidate;
      }
    }

    if (found) {
      matched.push({
        playerId: player.id,
        espnId: found.id,
        espnName: found.athlete.fullName,
      });
    } else {
      unmatched.push({ playerId: player.id, name: player.name });
    }
  }

  return { matched, unmatched };
}

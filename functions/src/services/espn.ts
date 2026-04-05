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
 * Match our players to ESPN competitors by name.
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

  for (const player of ourPlayers) {
    const normalizedOurs = normalizeName(player.name);

    // Try exact match on fullName first
    let found = espnCompetitors.find(
      (c) => c.athlete.fullName === player.name
    );

    // Try normalized match
    if (!found) {
      found = espnCompetitors.find(
        (c) => normalizeName(c.athlete.fullName) === normalizedOurs
      );
    }

    // Try displayName normalized
    if (!found) {
      found = espnCompetitors.find(
        (c) => normalizeName(c.athlete.displayName) === normalizedOurs
      );
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

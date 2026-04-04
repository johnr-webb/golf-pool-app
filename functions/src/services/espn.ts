import fetch from "node-fetch";
import { EspnCompetitor } from "../types";

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard";

export async function fetchScoreboard(): Promise<EspnCompetitor[]> {
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

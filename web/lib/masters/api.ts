// Masters data fetching — fetches directly from masters.com in the browser.
// Falls back to Next.js proxy routes if CORS blocks direct access.
// Temporary: only used for the 2026 Masters tournament.

import type { MastersRawScoresData, MastersRawPlayer, MastersRawHole } from "./types";
import type { TeamPicksResponse } from "@/lib/types/api";
import { apiFetch } from "@/lib/api/client";

const MASTERS_BASE = "https://www.masters.com/en_US";

async function fetchWithFallback(directUrl: string, proxyUrl: string): Promise<Response> {
  try {
    const res = await fetch(directUrl);
    if (res.ok) return res;
  } catch {
    // CORS or network error — fall back to proxy
  }
  return fetch(proxyUrl);
}

export async function fetchMastersScores(
  year: string,
): Promise<MastersRawScoresData> {
  const res = await fetchWithFallback(
    `${MASTERS_BASE}/scores/feeds/${year}/scores.json`,
    `/masters/scores/${year}`,
  );
  if (!res.ok) throw new Error(`Masters scores fetch failed: ${res.status}`);
  const json = await res.json();
  // Direct response wraps data in { data: ... }, proxy already unwraps
  return json.data ?? json;
}

export async function fetchMastersPlayers(
  year: string,
): Promise<MastersRawPlayer[]> {
  const res = await fetchWithFallback(
    `${MASTERS_BASE}/cms/feeds/players/${year}/players.json`,
    `/masters/players/${year}`,
  );
  if (!res.ok) return [];
  const json = await res.json();
  const players = json.players ?? json;
  return Array.isArray(players)
    ? players.filter((p: { real_player?: boolean }) => p.real_player)
    : players;
}

export async function fetchMastersHoles(): Promise<MastersRawHole[]> {
  const res = await fetchWithFallback(
    `${MASTERS_BASE}/json/man/course/angc/holes.json`,
    `/masters/holes`,
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.holes ?? json;
}

export async function fetchTeamPicks(
  poolId: string,
): Promise<TeamPicksResponse> {
  return apiFetch<TeamPicksResponse>(`/pools/${poolId}/team-picks`);
}

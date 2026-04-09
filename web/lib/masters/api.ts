// Masters data fetching — browser fetches directly from masters.com.
// Temporary: only used for the 2026 Masters tournament.

import type { MastersRawScoresData, MastersRawPlayer, MastersRawHole } from "./types";
import type { TeamPicksResponse } from "@/lib/types/api";
import { apiFetch } from "@/lib/api/client";

const MASTERS_BASE = "https://www.masters.com/en_US";

export async function fetchMastersScores(
  year: string,
): Promise<MastersRawScoresData> {
  const res = await fetch(`${MASTERS_BASE}/scores/feeds/${year}/scores.json`);
  if (!res.ok) throw new Error(`Masters scores fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function fetchMastersPlayers(
  year: string,
): Promise<MastersRawPlayer[]> {
  const res = await fetch(`${MASTERS_BASE}/cms/feeds/players/${year}/players.json`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.players ?? []).filter((p: { real_player?: boolean }) => p.real_player);
}

export async function fetchMastersHoles(): Promise<MastersRawHole[]> {
  const res = await fetch(`${MASTERS_BASE}/json/man/course/angc/holes.json`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.holes ?? [];
}

export async function fetchTeamPicks(
  poolId: string,
): Promise<TeamPicksResponse> {
  return apiFetch<TeamPicksResponse>(`/pools/${poolId}/team-picks`);
}

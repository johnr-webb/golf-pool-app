// Masters data fetching — hits Next.js API route proxies.
// Temporary: only used for the 2026 Masters tournament.

import type { MastersRawScoresData, MastersRawPlayer, MastersRawHole } from "./types";
import type { TeamPicksResponse } from "@/lib/types/api";
import { apiFetch } from "@/lib/api/client";

export async function fetchMastersScores(
  year: string,
): Promise<MastersRawScoresData> {
  const res = await fetch(`/masters/scores/${year}`);
  if (!res.ok) throw new Error(`Masters scores fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchMastersPlayers(
  year: string,
): Promise<MastersRawPlayer[]> {
  const res = await fetch(`/masters/players/${year}`);
  if (!res.ok) return []; // non-fatal, bio data is optional
  return res.json();
}

export async function fetchMastersHoles(): Promise<MastersRawHole[]> {
  const res = await fetch(`/masters/holes`);
  if (!res.ok) return []; // non-fatal, hole details are optional
  return res.json();
}

export async function fetchTeamPicks(
  poolId: string,
): Promise<TeamPicksResponse> {
  return apiFetch<TeamPicksResponse>(`/pools/${poolId}/team-picks`);
}

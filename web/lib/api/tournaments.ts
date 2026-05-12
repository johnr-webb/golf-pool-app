import { apiFetch } from "./client";
import type { PlayerDetail, TournamentSummary } from "@/lib/types/api";

export const listTournaments = () =>
  apiFetch<TournamentSummary[]>(`/tournaments`);

export const listTournamentPlayers = (tournamentId: string) =>
  apiFetch<PlayerDetail[]>(`/tournaments/${tournamentId}/players`);

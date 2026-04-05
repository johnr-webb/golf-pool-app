import { apiFetch } from "./client";
import type {
  PlayerDetail,
  TournamentStatus,
  TournamentSummary,
} from "@/lib/types/api";

export const listTournaments = (status?: TournamentStatus) => {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<TournamentSummary[]>(`/tournaments${qs}`);
};

export const listTournamentPlayers = (tournamentId: string) =>
  apiFetch<PlayerDetail[]>(`/tournaments/${tournamentId}/players`);

import { apiFetch } from "./client";
import type {
  CreateTeamInput,
  TeamDetail,
  UpdateTeamInput,
} from "@/lib/types/api";

export const getTeam = (teamId: string) =>
  apiFetch<TeamDetail>(`/teams/${teamId}`);

export const createTeam = (poolId: string, body: CreateTeamInput) =>
  apiFetch<{ id: string }>(`/teams/pools/${poolId}/teams`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateTeam = (teamId: string, body: UpdateTeamInput) =>
  apiFetch<{ success: boolean }>(`/teams/${teamId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

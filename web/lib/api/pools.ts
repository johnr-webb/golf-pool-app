import { apiFetch } from "./client";
import type {
  CreatePoolInput,
  LeaderboardResponse,
  PoolDetail,
  PoolSummary,
} from "@/lib/types/api";

export const listMyPools = () => apiFetch<PoolSummary[]>("/pools/mine");

export const getPoolDetail = (poolId: string) =>
  apiFetch<PoolDetail>(`/pools/${poolId}`);

export const createPool = (body: CreatePoolInput) =>
  apiFetch<{ id: string }>("/pools", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const joinPool = (poolId: string, password: string) =>
  apiFetch<{ success: boolean; poolId: string; message: string }>(
    `/pools/${poolId}/join`,
    {
      method: "POST",
      body: JSON.stringify({ password }),
    },
  );

export const leavePool = (poolId: string) =>
  apiFetch<{ success: boolean }>(`/pools/${poolId}/leave`, { method: "POST" });

export const getLeaderboard = (poolId: string) =>
  apiFetch<LeaderboardResponse>(`/pools/${poolId}/leaderboard`);

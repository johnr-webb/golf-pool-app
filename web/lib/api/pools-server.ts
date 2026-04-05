import "server-only";
import { apiFetchServer } from "./server";
import type {
  LeaderboardResponse,
  PoolDetail,
  PoolSummary,
} from "@/lib/types/api";

// Server-only counterparts of lib/api/pools.ts. Same shapes, different
// transport (reads the session cookie from next/headers).

export const listMyPoolsServer = () =>
  apiFetchServer<PoolSummary[]>("/pools/mine");

export const getPoolDetailServer = (poolId: string) =>
  apiFetchServer<PoolDetail>(`/pools/${poolId}`);

export const getLeaderboardServer = (poolId: string) =>
  apiFetchServer<LeaderboardResponse>(`/pools/${poolId}/leaderboard`);

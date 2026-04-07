// Frontend wire types. Kept in sync manually with:
//   - functions/src/types/index.ts (Firestore shapes with Timestamp)
//   - docs/openapi.yaml (HTTP surface, authoritative)
//
// Differences from the backend types: Timestamps become ISO strings over the
// wire, and we never type the pool password (it's never returned by any GET).
// Consider switching to openapi-typescript codegen in a later phase.

export type TournamentStatus = "upcoming" | "active" | "completed";

export interface Me {
  uid: string;
  email: string;
  displayName: string;
  realName: string;
  admin: boolean;
}

export interface UpdateMeInput {
  displayName?: string;
  realName?: string;
}

export interface TierConfig {
  tierNumber: number;
  oddsMin: string;
  oddsMax: string;
  picksRequired: number;
}

export interface ScoringRule {
  countBest: number;
  outOf: number;
}

export interface TournamentSummary {
  id: string;
  name: string;
  espnEventId: string | null;
  startDate: string | null;
  endDate: string | null;
  status: TournamentStatus;
}

export interface PlayerDetail {
  id: string;
  name: string;
  odds: string;
  espnMapped: boolean;
}

export interface PoolSummary {
  id: string;
  name: string;
  tournamentId: string;
  tournamentName: string | null;
  tournamentStatus: TournamentStatus | null;
  createdBy: string;
  myTeamId: string | null;
}

export interface PoolDetail extends PoolSummary {
  tiers: TierConfig[];
  scoringRule: ScoringRule;
}

export interface TeamOwner {
  userId: string;
  ownerName: string;
}

export interface TeamDetail extends TeamOwner {
  id: string;
  name: string;
  poolId: string;
  players: PlayerDetail[];
  createdAt: string;
  updatedAt: string;
}

export interface PlayerScore {
  playerId: string;
  playerName: string;
  score: number | null;
  missedCut: boolean;
  counting: boolean;
}

export interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  userId: string;
  totalScore: number;
  playerScores: PlayerScore[];
}

export interface UpcomingTeam extends TeamOwner {
  teamId: string;
  teamName: string;
  isMine: boolean;
  players: PlayerDetail[];
}

export type LeaderboardResponse =
  | { status: "upcoming"; teams: UpcomingTeam[] }
  | {
      status: "active" | "completed";
      leaderboard: LeaderboardEntry[];
    };

// Inputs
export interface CreatePoolInput {
  name: string;
  password: string;
  tournamentId: string;
  tiers: TierConfig[];
  scoringRule: ScoringRule;
}

export interface CreateTeamInput {
  name: string;
  picks: string[];
}

export interface UpdateTeamInput {
  name?: string;
  picks?: string[];
}

import { Timestamp } from "firebase-admin/firestore";

export interface User {
  email: string;
  // Public nickname shown throughout the app.
  displayName: string;
  // Legal/real name — captured at signup for record-keeping, not shown publicly
  // unless the owner surfaces it. Required going forward; legacy docs may have "".
  realName: string;
  admin: boolean;
  createdAt: Timestamp;
}

export interface Tournament {
  name: string;
  espnEventId: string | null;
  startDate: Timestamp;
  endDate: Timestamp;
  cutLine: number | null;
  status: "upcoming" | "active" | "completed";
  createdAt: Timestamp;
}

export interface Player {
  name: string;
  /** Accent-stripped, lowercased name for cross-source matching */
  normalizedName?: string;
  odds: string;
  tournamentId: string;
  espnId: string | null;
  espnMapped: boolean;
  createdAt: Timestamp;
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

export interface Pool {
  name: string;
  password: string;
  tournamentId: string;
  createdBy: string;
  tiers: TierConfig[];
  scoringRule: ScoringRule;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Team {
  name: string;
  userId: string;
  poolId: string;
  picks: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ESPN API types
export interface EspnCompetitor {
  id: string;
  athlete: {
    fullName: string;
    displayName: string;
  };
  score: string;
  status?: {
    type?: {
      name?: string;
      description?: string;
    };
  };
}

export interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  userId: string;
  totalScore: number;
  playerScores: {
    playerId: string;
    playerName: string;
    score: number | null;
    missedCut: boolean;
    counting: boolean;
  }[];
}

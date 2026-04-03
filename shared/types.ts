export interface User {
  uid: string;
  email: string;
  displayName: string;
}

export type OddsBucket = "favorite" | "contender" | "longshot";

export interface Golfer {
  id: string;
  name: string;
  bucket: OddsBucket;
  odds: number;
  worldRanking: number;
  imageUrl?: string;
  country: string;
}

export interface Pool {
  id: string;
  name: string;
  createdBy: string;
  inviteCode: string;
  lockTime: Date;
  createdAt: Date;
}

export interface PoolMember {
  userId: string;
  userName: string;
  selections: {
    favorite?: string;
    contender?: string;
    longshot?: string;
  };
  totalScore: number;
  submittedAt: Date;
}

export interface Selection {
  favorite?: string;
  contender?: string;
  longshot?: string;
}

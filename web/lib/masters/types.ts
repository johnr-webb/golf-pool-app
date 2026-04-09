export interface MastersLeader {
  pos: string;
  name: string;
  countryCode: string;
  score: string;
  thru: string;
}

export interface MastersHoleInfo {
  number: number;
  name: string;
  par: number;
  yardage: number;
}

export interface MastersPlayerBio {
  countryCode: string;
  age: string;
  height: string;
  swing: string;
  pastChampion: boolean;
  amateur: boolean;
  firstMasters: boolean;
}

export interface MastersPlayerRound {
  scores: (number | null)[];
  total: number | null;
  status: string;
}

export interface MastersPlayerScore {
  playerId: string;
  playerName: string;
  score: number | null;
  missedCut: boolean;
  counting: boolean;
  mastersId: string | null;
  bio: MastersPlayerBio | null;
  pos: string | null;
  today: string | null;
  thru: string | null;
  currentHole: number | null;
  rounds: MastersPlayerRound[];
}

export interface MastersLeaderboardEntry {
  teamId: string;
  teamName: string;
  userId: string;
  totalScore: number;
  playerScores: MastersPlayerScore[];
}

export interface MastersLeaderboardResponse {
  status: "active" | "completed";
  mastersYear: string;
  currentRound: number;
  leaders: MastersLeader[];
  holes: MastersHoleInfo[];
  roundPars: number[][];
  leaderboard: MastersLeaderboardEntry[];
}

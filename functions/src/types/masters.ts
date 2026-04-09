// Types for masters.com API responses and the enriched leaderboard response.

// --- Raw API types (from masters.com) ---

export interface MastersRawPlayer {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  display_name: string;
  countryCode: string;
  countryName: string;
  age: string;
  height: string;
  weight: string;
  swing: string;
  past_champion: boolean;
  amateur: boolean;
  first_masters: boolean;
  real_player: boolean;
  dq: boolean;
  wd: boolean;
}

export interface MastersRawRound {
  prior: number | null;
  fantasy: number;
  total: number | null;
  roundStatus: string;
  teetime: string;
  scores: (number | null)[];
}

export interface MastersRawScorePlayer {
  id: string;
  display_name: string;
  display_name2: string;
  first_name: string;
  last_name: string;
  full_name: string;
  countryCode: string;
  countryName: string;
  pos: string;
  amateur: boolean;
  past: boolean;
  firsttimer: boolean;
  status: string;
  active: boolean;
  teetime: string;
  today: string;
  thru: string;
  topar: string;
  total: string;
  sort_order: string;
  holeProgress: number;
  round1: MastersRawRound;
  round2: MastersRawRound;
  round3: MastersRawRound;
  round4: MastersRawRound;
}

export interface MastersRawScoresData {
  currentRound: string;
  statusRound: string;
  wallClockTime: string;
  pars: {
    round1: number[];
    round2: number[];
    round3: number[];
    round4: number[];
  };
  yardages: {
    round1: number[];
    round2: number[];
    round3: number[];
    round4: number[];
  };
  player: MastersRawScorePlayer[];
}

export interface MastersRawHole {
  number: string;
  par: string;
  yds: string;
  plant: string;
  holeDesc: string;
  imageH: { src: string; width: string; height: string };
  eagles: string;
  birdies: string;
  pars: string;
  bogies: string;
  dblBogies: string;
}

// --- Enriched response types (sent to frontend) ---

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

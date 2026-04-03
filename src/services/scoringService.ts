import { mockGolfers } from '../data/mockGolfers';
import type { Selection, PoolMember } from '../types';

export interface GolferScore {
  golferId: string;
  score: number;
  through: number;
  status: 'active' | 'cut' | 'finished' | 'withdrawn';
}

export interface MockScores {
  [golferId: string]: GolferScore;
}

const generateMockScores = (): MockScores => {
  const scores: MockScores = {};
  
  mockGolfers.forEach(golfer => {
    const isActive = Math.random() > 0.2;
    const isCut = !isActive && Math.random() > 0.5;
    
    scores[golfer.id] = {
      golferId: golfer.id,
      score: Math.floor(Math.random() * 15) - 3,
      through: isActive ? Math.floor(Math.random() * 18) + 1 : Math.floor(Math.random() * 14) + 1,
      status: isActive ? 'active' : isCut ? 'cut' : 'finished',
    };
  });

  return scores;
};

let cachedScores: MockScores | null = null;

export function getCurrentScores(): MockScores {
  if (!cachedScores) {
    cachedScores = generateMockScores();
  }
  return cachedScores;
}

export function refreshScores(): MockScores {
  cachedScores = generateMockScores();
  return cachedScores;
}

export function calculateMemberScore(selections: Selection): number {
  const scores = getCurrentScores();
  let totalScore = 0;

  const golferIds = [selections.favorite, selections.contender, selections.longshot].filter(Boolean) as string[];
  
  golferIds.forEach(golferId => {
    const golferScore = scores[golferId];
    if (golferScore && golferScore.status !== 'withdrawn') {
      totalScore += golferScore.score;
    }
  });

  return totalScore;
}

export function calculateAllMemberScores(members: PoolMember[]): PoolMember[] {
  return members.map(member => ({
    ...member,
    totalScore: calculateMemberScore(member.selections),
  }));
}

export function getLeaderboard(members: PoolMember[]): PoolMember[] {
  return calculateAllMemberScores(members).sort((a, b) => b.totalScore - a.totalScore);
}

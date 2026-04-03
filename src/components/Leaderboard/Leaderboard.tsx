import { useState } from 'react';
import { getGolferById } from '../../data/mockGolfers';
import { useAuth } from '../../context/AuthContext';
import type { PoolMember } from '../../types';

interface LeaderboardEntry extends PoolMember {
  rank: number;
}

interface LeaderboardProps {
  members: PoolMember[];
  isLocked: boolean;
}

export default function Leaderboard({ members, isLocked }: LeaderboardProps) {
  const { user } = useAuth();
  const [showScores, setShowScores] = useState(false);

  const sortedMembers = [...members].sort((a, b) => b.totalScore - a.totalScore);
  
  const entries: LeaderboardEntry[] = sortedMembers.map((member, index) => ({
    ...member,
    rank: index + 1,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Leaderboard {isLocked ? '(Scores Visible)' : '(Scores Hidden)'}
        </h2>
        {isLocked && (
          <button
            onClick={() => setShowScores(!showScores)}
            className="text-sm text-[#1e3a5f] hover:underline"
          >
            {showScores ? 'Hide Scores' : 'Show Scores'}
          </button>
        )}
      </div>

      {!isLocked && (
        <p className="text-sm text-gray-500 mb-4">
          Scores are hidden until selections are locked.
        </p>
      )}

      <div className="space-y-2">
        {entries.map(entry => {
          const isCurrentUser = entry.userId === user?.uid;
          return (
            <div
              key={entry.userId}
              className={`flex items-center justify-between p-3 rounded-lg ${
                isCurrentUser ? 'bg-[#1e3a5f]/10 border border-[#1e3a5f]/20' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${
                  entry.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                  entry.rank === 2 ? 'bg-gray-300 text-gray-700' :
                  entry.rank === 3 ? 'bg-amber-600 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {entry.rank}
                </span>
                <div>
                  <p className={`font-medium ${isCurrentUser ? 'text-[#1e3a5f]' : 'text-gray-900'}`}>
                    {entry.userName} {isCurrentUser && '(You)'}
                  </p>
                  {showScores && isLocked && (
                    <div className="flex gap-2 mt-1">
                      {Object.entries(entry.selections).map(([bucket, golferId]) => {
                        const golfer = golferId ? getGolferById(golferId) : null;
                        return golfer ? (
                          <span key={bucket} className="text-xs text-gray-500">
                            {golfer.name.split(' ').pop()}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                {showScores && isLocked ? (
                  <span className="font-bold text-lg text-[#1e3a5f]">{entry.totalScore}</span>
                ) : (
                  <span className="text-gray-400">---</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

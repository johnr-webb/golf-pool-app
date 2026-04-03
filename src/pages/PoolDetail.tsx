import { Link, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getGolfersByBucket, getGolferById } from '../data/mockGolfers';
import { usePool } from '../hooks/usePool';
import { useSelections } from '../hooks/useSelections';
import { useScoring } from '../hooks/useScoring';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import Leaderboard from '../components/Leaderboard/Leaderboard';
import { calculateAllMemberScores } from '../services/scoringService';
import type { OddsBucket, Selection } from '../types';

export default function PoolDetail() {
  const { poolId } = useParams<{ poolId: string }>();
  const { pool, members, loading, error, isLocked, memberCount, userSelections } = usePool(poolId!);
  const { save, saving } = useSelections(poolId!);
  const { scores, lastUpdate, refresh, loading: scoresLoading, error: scoresError } = useScoring(30000);
  const { copied, copy } = useCopyToClipboard();
  
  const [selections, setSelections] = useState<Selection>({
    favorite: undefined,
    contender: undefined,
    longshot: undefined,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'select' | 'leaderboard'>('select');

  useEffect(() => {
    if (userSelections) {
      setSelections(userSelections);
    }
  }, [userSelections]);

  const handleSelect = (bucket: OddsBucket, golferId: string) => {
    if (isLocked) return;
    setSelections(prev => ({ ...prev, [bucket]: golferId }));
    setHasChanges(true);
  };

  const handleSubmit = async () => {
    try {
      await save(selections);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save selections:', err);
    }
  };

  const isComplete = selections.favorite && selections.contender && selections.longshot;
  
  const scoredMembers = isLocked ? calculateAllMemberScores(members) : members;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{error || 'Pool not found'}</p>
          <Link to="/pools" className="text-[#1e3a5f] hover:underline">
            Back to Pools
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/pools" className="text-gray-500 hover:text-gray-700">
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">{pool.name}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{memberCount} members</span>
            {pool.inviteCode && (
              <button
                onClick={() => copy(pool.inviteCode)}
                className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-mono hover:bg-gray-200 transition flex items-center gap-2"
              >
                {copied ? 'Copied!' : pool.inviteCode}
                {!copied && (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('select')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'select'
                ? 'bg-[#1e3a5f] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Make Picks
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'leaderboard'
                ? 'bg-[#1e3a5f] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Leaderboard
          </button>
        </div>

        {activeTab === 'select' ? (
          <>
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Selections</h2>
              <div className="grid grid-cols-3 gap-4">
                {(['favorite', 'contender', 'longshot'] as OddsBucket[]).map(bucket => {
                  const golfer = selections[bucket] ? getGolferById(selections[bucket]!) : null;
                  const golferScore = golfer && scores[golfer.id];
                  return (
                    <div key={bucket} className="bg-gray-50 rounded-lg p-4 text-center">
                      <span className="text-xs uppercase text-gray-500 font-medium">
                        {bucket}
                      </span>
                      <p className="font-semibold text-gray-900 mt-1">
                        {golfer ? golfer.name : 'Not selected'}
                      </p>
                      {golferScore && isLocked && (
                        <p className={`text-sm mt-1 ${
                          golferScore.score <= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {golferScore.score > 0 ? '+' : ''}{golferScore.score}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {isComplete && !isLocked && (
                <button
                  onClick={handleSubmit}
                  disabled={saving || !hasChanges}
                  className="w-full mt-4 py-3 bg-[#4ade80] text-white font-semibold rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : hasChanges ? 'Submit Selections' : 'Selections Saved'}
                </button>
              )}
            </div>

            {!isLocked && (
              <p className="text-sm text-gray-500 mb-6 text-center">
                Lock time: {pool.lockTime.toLocaleString()}
              </p>
            )}

            <div className="space-y-8">
              {(['favorite', 'contender', 'longshot'] as OddsBucket[]).map(bucket => {
                const golfers = getGolfersByBucket(bucket);
                return (
                  <section key={bucket}>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4 capitalize">
                      {bucket}s (Pick 1)
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {golfers.map(golfer => {
                        const golferScore = scores[golfer.id];
                        return (
                          <button
                            key={golfer.id}
                            onClick={() => handleSelect(bucket, golfer.id)}
                            disabled={isLocked}
                            className={`bg-white rounded-xl shadow-sm p-4 text-left transition border-2 ${
                              selections[bucket] === golfer.id
                                ? 'border-[#4ade80] ring-2 ring-[#4ade80]/20'
                                : 'border-transparent hover:shadow-md'
                            } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-semibold text-gray-900">{golfer.name}</h3>
                                <p className="text-sm text-gray-500">#{golfer.worldRanking} in World</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-[#1e3a5f]">{golfer.odds / 100}:1</p>
                                <p className="text-xs text-gray-400">{golfer.country}</p>
                              </div>
                            </div>
                            {golferScore && isLocked && (
                              <div className="mt-2 pt-2 border-t border-gray-100">
                                <span className={`text-sm font-medium ${
                                  golferScore.score <= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {golferScore.score > 0 ? '+' : ''}{golferScore.score} (Thru {golferScore.through})
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <Leaderboard members={scoredMembers} isLocked={isLocked} />
            {isLocked && (
              <div className="text-center text-sm text-gray-500">
                {scoresError && (
                  <p className="text-red-500 mb-2">Error: {scoresError}</p>
                )}
                {scoresLoading ? (
                  <p>Updating scores...</p>
                ) : (
                  <>
                    <p>Scores auto-refresh every 30 seconds</p>
                    <p>Last updated: {lastUpdate.toLocaleTimeString()}</p>
                  </>
                )}
                <button
                  onClick={refresh}
                  disabled={scoresLoading}
                  className="mt-2 text-[#1e3a5f] hover:underline disabled:opacity-50"
                >
                  Refresh Now
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

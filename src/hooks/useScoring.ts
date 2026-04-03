import { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';
import type { MockScores } from '../services/scoringService';

interface FetchScoresResponse {
  success: boolean;
  scores?: Record<string, { score: number; thru: number; status: string }>;
  cached?: boolean;
  nextUpdateIn?: number;
}

function convertToMockScores(scores: Record<string, { score: number; thru: number; status: string }> | undefined): MockScores {
  if (!scores) return {};
  
  const mockScores: MockScores = {};
  Object.entries(scores).forEach(([golferId, data]) => {
    mockScores[golferId] = {
      golferId,
      score: data.score,
      through: data.thru,
      status: data.status as 'active' | 'cut' | 'finished' | 'withdrawn',
    };
  });
  return mockScores;
}

export function useScoring(intervalMs: number = 30000) {
  const [scores, setScores] = useState<MockScores>({});
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScoresFromCloud = useCallback(async () => {
    if (!functions) {
      console.warn('Firebase functions not initialized');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchScores = httpsCallable<{}, FetchScoresResponse>(functions, 'fetchScores');
      const result = await fetchScores({});
      
      if (result.data.success && result.data.scores) {
        const mockScores = convertToMockScores(result.data.scores);
        setScores(mockScores);
        setLastUpdate(new Date());
      }
    } catch (err: any) {
      console.error('Error fetching scores:', err);
      setError(err.message || 'Failed to fetch scores');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    fetchScoresFromCloud();
  }, [fetchScoresFromCloud]);

  useEffect(() => {
    fetchScoresFromCloud();

    const interval = setInterval(fetchScoresFromCloud, intervalMs);
    return () => clearInterval(interval);
  }, [fetchScoresFromCloud, intervalMs]);

  return {
    scores,
    lastUpdate,
    refresh,
    loading,
    error,
  };
}

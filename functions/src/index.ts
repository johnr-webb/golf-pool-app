import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { fetchLiveScores } from './golfApi';

admin.initializeApp();

const db = admin.firestore();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  lastUpdated: admin.firestore.Timestamp;
  tournament: {
    tournamentId: string;
    name: string;
    status: string;
    round: number;
  };
  scores: Record<string, {
    score: number;
    thru: number;
    status: string;
  }>;
}

export const fetchScores = functions.https.onCall(async (request) => {
  const userId = request.auth?.uid || 'anonymous';
  const tournamentId = request.data?.tournamentId || 'masters-2025';

  functions.logger.info(`Fetch scores requested by ${userId} for ${tournamentId}`);

  try {
    const scoresRef = db.collection('scores').doc(tournamentId);
    const cacheDoc = await scoresRef.get();
    const now = Date.now();

    if (cacheDoc.exists) {
      const cacheData = cacheDoc.data() as CacheData;
      const lastUpdate = cacheData.lastUpdated.toMillis();
      const timeSinceUpdate = now - lastUpdate;

      if (timeSinceUpdate < CACHE_TTL_MS) {
        functions.logger.info(`Returning cached scores (${Math.round(timeSinceUpdate / 1000)}s old)`);
        return {
          success: true,
          scores: cacheData.scores,
          tournament: cacheData.tournament,
          cached: true,
          nextUpdateIn: Math.round((CACHE_TTL_MS - timeSinceUpdate) / 1000),
        };
      }
    }

    functions.logger.info('Fetching fresh scores from API');
    const { tournament, scores } = await fetchLiveScores(tournamentId);

    const scoresMap: Record<string, {
      score: number;
      thru: number;
      status: string;
    }> = {};

    scores.forEach(s => {
      scoresMap[s.golferId] = {
        score: s.score,
        thru: s.thru,
        status: s.status,
      };
    });

    await scoresRef.set({
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      tournament: {
        tournamentId: tournament.tournamentId,
        name: tournament.name,
        status: tournament.status,
        round: tournament.round,
      },
      scores: scoresMap,
    });

    functions.logger.info(`Scores updated for ${tournamentId}`);

    return {
      success: true,
      scores: scoresMap,
      tournament: {
        tournamentId: tournament.tournamentId,
        name: tournament.name,
        status: tournament.status,
        round: tournament.round,
      },
      cached: false,
    };
  } catch (error: any) {
    functions.logger.error('Error fetching scores:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to fetch scores',
      error.message
    );
  }
});

export const getScores = functions.https.onCall(async (request) => {
  const tournamentId = request.data?.tournamentId || 'masters-2025';

  try {
    const scoresRef = db.collection('scores').doc(tournamentId);
    const cacheDoc = await scoresRef.get();

    if (!cacheDoc.exists) {
      return {
        success: true,
        scores: null,
        tournament: null,
        message: 'No scores available',
      };
    }

    const cacheData = cacheDoc.data() as CacheData;
    const now = Date.now();
    const lastUpdate = cacheData.lastUpdated.toMillis();
    const nextUpdateIn = Math.max(0, CACHE_TTL_MS - (now - lastUpdate));

    return {
      success: true,
      scores: cacheData.scores,
      tournament: cacheData.tournament,
      cached: true,
      nextUpdateIn: Math.round(nextUpdateIn / 1000),
    };
  } catch (error: any) {
    functions.logger.error('Error getting scores:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to get scores',
      error.message
    );
  }
});

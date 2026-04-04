import { Router } from "express";
import { db } from "../config/firebase";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { FieldValue } from "firebase-admin/firestore";
import {
  fetchScoreboard,
  fetchScoreboardForEvent,
} from "../services/espn";
import {
  parseScore,
  applyMissedCutPenalty,
  calculateTeamScore,
} from "../services/leaderboard";
import { LeaderboardEntry } from "../types";

const router = Router();

// POST /pools — Create pool (auth required)
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { name, password, tournamentId, tiers, scoringRule } = req.body;

  if (!name || !password || !tournamentId || !tiers || !scoringRule) {
    res.status(400).json({
      error: "name, password, tournamentId, tiers, and scoringRule are required",
    });
    return;
  }

  // Verify tournament exists
  const tournDoc = await db.collection("tournaments").doc(tournamentId).get();
  if (!tournDoc.exists) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  const doc = await db.collection("pools").add({
    name,
    password,
    tournamentId,
    createdBy: req.uid,
    tiers,
    scoringRule,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  res.status(201).json({ id: doc.id });
});

// POST /pools/:poolId/join — Join pool
router.post("/:poolId/join", requireAuth, async (req: AuthRequest, res) => {
  const { poolId } = req.params;
  const { password } = req.body;

  const poolDoc = await db.collection("pools").doc(poolId).get();
  if (!poolDoc.exists) {
    res.status(404).json({ error: "Pool not found" });
    return;
  }

  const pool = poolDoc.data()!;
  if (pool.password !== password) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  // Check if user already has a team in this pool
  const existing = await db
    .collection("teams")
    .where("poolId", "==", poolId)
    .where("userId", "==", req.uid)
    .limit(1)
    .get();

  if (!existing.empty) {
    res.status(409).json({ error: "You already have a team in this pool" });
    return;
  }

  res.json({ success: true, poolId, message: "Password accepted. Create a team to join." });
});

// POST /pools/:poolId/leave — Leave pool
router.post("/:poolId/leave", requireAuth, async (req: AuthRequest, res) => {
  const { poolId } = req.params;

  // Find and delete user's team in this pool
  const teamsSnap = await db
    .collection("teams")
    .where("poolId", "==", poolId)
    .where("userId", "==", req.uid)
    .get();

  if (teamsSnap.empty) {
    res.status(404).json({ error: "You don't have a team in this pool" });
    return;
  }

  const batch = db.batch();
  teamsSnap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  res.json({ success: true });
});

// GET /pools/:poolId/leaderboard — Get leaderboard
router.get("/:poolId/leaderboard", requireAuth, async (req: AuthRequest, res) => {
  const { poolId } = req.params;

  const poolDoc = await db.collection("pools").doc(poolId).get();
  if (!poolDoc.exists) {
    res.status(404).json({ error: "Pool not found" });
    return;
  }
  const pool = poolDoc.data()!;

  // Get tournament
  const tournDoc = await db.collection("tournaments").doc(pool.tournamentId).get();
  if (!tournDoc.exists) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }
  const tournament = tournDoc.data()!;

  // Get all teams in pool
  const teamsSnap = await db
    .collection("teams")
    .where("poolId", "==", poolId)
    .get();

  if (teamsSnap.empty) {
    res.json({ leaderboard: [] });
    return;
  }

  // If tournament hasn't started, return teams without scores
  if (tournament.status === "upcoming") {
    const teams = await Promise.all(
      teamsSnap.docs.map(async (teamDoc) => {
        const team = teamDoc.data();
        const playerDocs = await Promise.all(
          team.picks.map((id: string) => db.collection("players").doc(id).get())
        );
        return {
          teamId: teamDoc.id,
          teamName: team.name,
          userId: team.userId,
          players: playerDocs
            .filter((d) => d.exists)
            .map((d) => ({ id: d.id, name: d.data()!.name, odds: d.data()!.odds })),
        };
      })
    );
    res.json({ status: "upcoming", teams });
    return;
  }

  // Tournament is active or completed — fetch ESPN scores
  let competitors;
  try {
    competitors = tournament.espnEventId
      ? await fetchScoreboardForEvent(tournament.espnEventId)
      : await fetchScoreboard();
  } catch {
    res.status(502).json({ error: "Failed to fetch ESPN scores" });
    return;
  }

  // Build score map: espnId -> { score, missedCut }
  const scoreMap = new Map<string, { score: number; missedCut: boolean }>();
  for (const c of competitors) {
    const missedCut =
      c.status?.type?.name === "STATUS_CUT" ||
      c.status?.type?.description?.toLowerCase().includes("cut");
    scoreMap.set(c.id, {
      score: parseScore(c.score),
      missedCut: !!missedCut,
    });
  }

  // Apply missed-cut penalty
  const adjustedScores = applyMissedCutPenalty(scoreMap);

  // Calculate each team's score
  const leaderboard: LeaderboardEntry[] = await Promise.all(
    teamsSnap.docs.map(async (teamDoc) => {
      const team = teamDoc.data();
      const playerDocs = await Promise.all(
        team.picks.map((id: string) => db.collection("players").doc(id).get())
      );

      const playerScores = playerDocs
        .filter((d) => d.exists)
        .map((d) => {
          const data = d.data()!;
          const espnData = data.espnId ? adjustedScores.get(data.espnId) : null;
          return {
            playerId: d.id,
            playerName: data.name,
            espnId: data.espnId,
            score: espnData?.score ?? null,
            missedCut: espnData?.missedCut ?? false,
          };
        });

      const result = calculateTeamScore(playerScores, pool.scoringRule);
      return {
        teamId: teamDoc.id,
        teamName: team.name,
        userId: team.userId,
        totalScore: result.totalScore,
        playerScores: result.map((r) => ({
          playerId: r.playerId,
          playerName: r.playerName,
          score: r.score,
          missedCut: r.missedCut,
          counting: r.counting,
        })),
      };
    })
  );

  // Sort by total score ascending (lowest is best in golf)
  leaderboard.sort((a, b) => a.totalScore - b.totalScore);

  res.json({ status: tournament.status, leaderboard });
});

export default router;

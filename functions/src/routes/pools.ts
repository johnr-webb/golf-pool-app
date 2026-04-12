import { Router } from "express";
import { db } from "../config/firebase";
import { AuthRequest, requireAuth, requireAdmin } from "../middleware/auth";
import { FieldValue } from "firebase-admin/firestore";
import { fetchScoreboard, fetchScoreboardForEvent } from "../services/espn";
import {
  parseScore,
  applyMissedCutPenalty,
  calculateTeamScore,
} from "../services/leaderboard";
import { EspnScoreboard, LeaderboardEntry } from "../types";
import {
  loadOwnerNames,
  serializePlayerDetail,
} from "../utils/teamSerializers";
import { logRouteAck, logRouteError, logRouteStep } from "../utils/logging";

const router = Router();

// POST /pools — Create pool. Admin-only for now (phase 1). See John's open
// architectural question about per-pool ownership in plan/PLAN_V3.md.
router.post("/", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { name, password, tournamentId, tiers, scoringRule } = req.body;
  logRouteAck("POST /pools", req, {
    name: name ?? null,
    tournamentId: tournamentId ?? null,
    tiersCount: Array.isArray(tiers) ? tiers.length : null,
  });

  if (!name || !password || !tournamentId || !tiers || !scoringRule) {
    res.status(400).json({
      error:
        "name, password, tournamentId, tiers, and scoringRule are required",
    });
    return;
  }

  // Verify tournament exists
  const tournDoc = await db.collection("tournaments").doc(tournamentId).get();
  if (!tournDoc.exists) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  logRouteStep("POST /pools", req, "creating pool document", { tournamentId });
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
  logRouteAck("POST /pools/:poolId/join", req, {
    poolId,
    passwordProvided: typeof password === "string",
  });

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

  res.json({
    success: true,
    poolId,
    message: "Password accepted. Create a team to join.",
  });
});

// POST /pools/:poolId/leave — Leave pool
router.post("/:poolId/leave", requireAuth, async (req: AuthRequest, res) => {
  const { poolId } = req.params;
  logRouteAck("POST /pools/:poolId/leave", req, { poolId });

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

  logRouteStep(
    "POST /pools/:poolId/leave",
    req,
    "deleting pool team documents",
    {
      poolId,
      teamCount: teamsSnap.docs.length,
    },
  );
  const batch = db.batch();
  teamsSnap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  res.json({ success: true });
});

// GET /pools/mine — List pools the caller is a member of (has a team) or created.
// Registered before /:poolId routes so Express doesn't treat "mine" as a poolId.
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  logRouteAck("GET /pools/mine", req);

  // Pools where I have a team → capture myTeamId per pool
  const teamsSnap = await db
    .collection("teams")
    .where("userId", "==", req.uid)
    .get();
  const teamIdByPool = new Map<string, string>();
  teamsSnap.docs.forEach((d) => {
    teamIdByPool.set(d.data().poolId as string, d.id);
  });

  // Pools I created (even if I haven't made a team yet)
  const createdSnap = await db
    .collection("pools")
    .where("createdBy", "==", req.uid)
    .get();

  const poolIds = new Set<string>([
    ...teamIdByPool.keys(),
    ...createdSnap.docs.map((d) => d.id),
  ]);

  if (poolIds.size === 0) {
    res.json([]);
    return;
  }

  // Fetch pool docs + tournament docs (dedupe tournament lookups)
  const poolDocs = await Promise.all(
    [...poolIds].map((id) => db.collection("pools").doc(id).get()),
  );
  const tournamentIds = new Set<string>();
  poolDocs.forEach((p) => {
    if (p.exists) tournamentIds.add(p.data()!.tournamentId as string);
  });
  const tournamentDocs = await Promise.all(
    [...tournamentIds].map((id) => db.collection("tournaments").doc(id).get()),
  );
  const tournamentById = new Map<
    string,
    { name: string; status: "upcoming" | "active" | "completed" }
  >();
  tournamentDocs.forEach((t) => {
    if (t.exists) {
      const data = t.data()!;
      tournamentById.set(t.id, { name: data.name, status: data.status });
    }
  });

  const result = poolDocs
    .filter((p) => p.exists)
    .map((p) => {
      const data = p.data()!;
      const tourn = tournamentById.get(data.tournamentId);
      return {
        id: p.id,
        name: data.name,
        tournamentId: data.tournamentId,
        tournamentName: tourn?.name ?? null,
        tournamentStatus: tourn?.status ?? null,
        createdBy: data.createdBy,
        myTeamId: teamIdByPool.get(p.id) ?? null,
      };
    });

  res.json(result);
});

// GET /pools/:poolId — Pool detail (tiers, scoring rule, tournament summary).
// Does NOT return the password. Used by the team picker and pool detail screens.
router.get("/:poolId", requireAuth, async (req: AuthRequest, res) => {
  const { poolId } = req.params;
  logRouteAck("GET /pools/:poolId", req, { poolId });

  const poolDoc = await db.collection("pools").doc(poolId).get();
  if (!poolDoc.exists) {
    res.status(404).json({ error: "Pool not found" });
    return;
  }
  const pool = poolDoc.data()!;

  const tournDoc = await db
    .collection("tournaments")
    .doc(pool.tournamentId)
    .get();
  const tournament = tournDoc.exists ? tournDoc.data()! : null;

  // myTeamId for the caller (if any)
  const teamSnap = await db
    .collection("teams")
    .where("poolId", "==", poolId)
    .where("userId", "==", req.uid)
    .limit(1)
    .get();
  const myTeamId = teamSnap.empty ? null : teamSnap.docs[0].id;

  res.json({
    id: poolDoc.id,
    name: pool.name,
    tournamentId: pool.tournamentId,
    tournamentName: tournament?.name ?? null,
    tournamentStatus: tournament?.status ?? null,
    mastersYear: tournament?.mastersYear ?? null,
    createdBy: pool.createdBy,
    tiers: pool.tiers,
    scoringRule: pool.scoringRule,
    myTeamId,
  });
});

// GET /pools/:poolId/team-picks — lightweight team+player data for client-side scoring (Masters).
router.get(
  "/:poolId/team-picks",
  requireAuth,
  async (req: AuthRequest, res) => {
    const { poolId } = req.params;
    const poolDoc = await db.collection("pools").doc(poolId).get();
    if (!poolDoc.exists) {
      res.status(404).json({ error: "Pool not found" });
      return;
    }

    const teamsSnap = await db
      .collection("teams")
      .where("poolId", "==", poolId)
      .get();

    const allPickIds = new Set<string>();
    const teamData = teamsSnap.docs.map((doc) => {
      const data = doc.data();
      const picks: string[] = data.picks || [];
      picks.forEach((id: string) => allPickIds.add(id));
      return {
        teamId: doc.id,
        teamName: data.name as string,
        userId: data.userId as string,
        picks,
      };
    });

    const playerSnaps = await Promise.all(
      [...allPickIds].map((id) => db.collection("players").doc(id).get()),
    );
    const playerMap = new Map<string, string>();
    for (const snap of playerSnaps) {
      if (snap.exists) playerMap.set(snap.id, snap.data()!.name);
    }

    // Load full user profiles for display name + real name
    const uniqueUserIds = [...new Set(teamData.map((t) => t.userId))];
    const userDocs = await Promise.all(
      uniqueUserIds.map((uid) => db.collection("users").doc(uid).get()),
    );
    const userMap = new Map<string, { displayName: string; realName: string }>();
    for (const doc of userDocs) {
      if (doc.exists) {
        const u = doc.data()!;
        userMap.set(doc.id, {
          displayName: (u.displayName as string) || "",
          realName: (u.realName as string) || "",
        });
      }
    }

    res.set("Cache-Control", "public, s-maxage=300");
    res.json({
      teams: teamData.map((t) => {
        const owner = userMap.get(t.userId);
        return {
          teamId: t.teamId,
          teamName: t.teamName,
          userId: t.userId,
          displayName: owner?.displayName ?? "",
          realName: owner?.realName ?? "",
          picks: t.picks.map((id) => ({
            id,
            name: playerMap.get(id) || "Unknown",
          })),
        };
      }),
    });
  },
);

/**
 * Map ESPN event state to our tournament status.
 * ESPN: "pre" (not started), "in" (in progress), "post" (finished)
 */
function espnStateToStatus(
  state: string,
): "upcoming" | "active" | "completed" {
  if (state === "in") return "active";
  if (state === "post") return "completed";
  return "upcoming";
}

// GET /pools/:poolId/leaderboard — Get leaderboard.
// Status is derived from the ESPN event state, not from the Firestore doc.
// Firestore is updated as a side effect so team-edit lockout stays in sync.
router.get(
  "/:poolId/leaderboard",
  requireAuth,
  async (req: AuthRequest, res) => {
    const { poolId } = req.params;
    logRouteAck("GET /pools/:poolId/leaderboard", req, { poolId });

    const poolDoc = await db.collection("pools").doc(poolId).get();
    if (!poolDoc.exists) {
      res.status(404).json({ error: "Pool not found" });
      return;
    }
    const pool = poolDoc.data()!;

    // Get tournament
    const tournDoc = await db
      .collection("tournaments")
      .doc(pool.tournamentId)
      .get();
    if (!tournDoc.exists) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }
    const tournament = tournDoc.data()!;

    // Fetch ESPN — it's the source of truth for status + scores
    let scoreboard: EspnScoreboard;
    try {
      logRouteStep(
        "GET /pools/:poolId/leaderboard",
        req,
        "fetching ESPN scoreboard",
        {
          poolId,
          tournamentId: pool.tournamentId,
          espnEventId: tournament.espnEventId ?? null,
        },
      );
      scoreboard = tournament.espnEventId
        ? await fetchScoreboardForEvent(tournament.espnEventId)
        : await fetchScoreboard();
    } catch (error) {
      logRouteError(
        "GET /pools/:poolId/leaderboard",
        req,
        "failed to fetch ESPN scoreboard",
        error,
        {
          poolId,
          tournamentId: pool.tournamentId,
          espnEventId: tournament.espnEventId ?? null,
        },
      );
      res.status(502).json({ error: "Failed to fetch ESPN scores" });
      return;
    }

    const status = espnStateToStatus(scoreboard.eventStatus.state);

    // Side-effect: keep Firestore status in sync so team-edit lockout works
    if (tournament.status !== status) {
      tournDoc.ref
        .update({ status })
        .catch((err: unknown) =>
          console.warn("[leaderboard] failed to sync tournament status:", err),
        );
    }

    // Get all teams in pool
    const teamsSnap = await db
      .collection("teams")
      .where("poolId", "==", poolId)
      .get();

    if (teamsSnap.empty) {
      res.json(
        status === "upcoming"
          ? { status: "upcoming", teams: [] }
          : { status, leaderboard: [] },
      );
      return;
    }

    // If tournament hasn't started, return teams without scores
    if (status === "upcoming") {
      const ownerNameByUserId = await loadOwnerNames(
        teamsSnap.docs.map((teamDoc) => teamDoc.data().userId as string),
      );

      const teams = await Promise.all(
        teamsSnap.docs.map(async (teamDoc) => {
          const team = teamDoc.data();
          const isMine = team.userId === req.uid;
          const playerDocs = isMine
            ? await Promise.all(
                team.picks.map((id: string) =>
                  db.collection("players").doc(id).get(),
                ),
              )
            : [];
          return {
            teamId: teamDoc.id,
            teamName: team.name,
            userId: team.userId,
            ownerName: ownerNameByUserId.get(team.userId) ?? "Unknown player",
            isMine,
            players: playerDocs
              .map(serializePlayerDetail)
              .filter((player) => player !== null),
          };
        }),
      );
      res.json({ status: "upcoming", teams });
      return;
    }

    // Tournament is active or completed — calculate scores
    const { competitors } = scoreboard;

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
          team.picks.map((id: string) =>
            db.collection("players").doc(id).get(),
          ),
        );

        const playerScores = playerDocs
          .filter((d) => d.exists)
          .map((d) => {
            const data = d.data()!;
            const espnData = data.espnId
              ? adjustedScores.get(data.espnId)
              : null;
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
      }),
    );

    // Sort by total score ascending (lowest is best in golf)
    leaderboard.sort((a, b) => a.totalScore - b.totalScore);

    logRouteStep(
      "GET /pools/:poolId/leaderboard",
      req,
      "calculated leaderboard",
      {
        poolId,
        teamCount: leaderboard.length,
        espnState: scoreboard.eventStatus.state,
        status,
      },
    );

    res.json({ status, leaderboard });
  },
);

export default router;

import { Router } from "express";
import { db } from "../config/firebase";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { FieldValue } from "firebase-admin/firestore";
import { validatePicks } from "../services/validation";
import {
  loadOwnerNames,
  serializePlayerDetail,
} from "../utils/teamSerializers";
import { logRouteAck, logRouteStep } from "../utils/logging";

const router = Router();

// POST /pools/:poolId/teams — Create team in a pool
router.post(
  "/pools/:poolId/teams",
  requireAuth,
  async (req: AuthRequest, res) => {
    const { poolId } = req.params;
    const { name, picks } = req.body;
    logRouteAck("POST /teams/pools/:poolId/teams", req, {
      poolId,
      name: name ?? null,
      picksCount: Array.isArray(picks) ? picks.length : null,
    });

    if (!name || !Array.isArray(picks) || picks.length === 0) {
      res.status(400).json({ error: "name and picks array are required" });
      return;
    }

    // Get pool
    const poolDoc = await db.collection("pools").doc(poolId).get();
    if (!poolDoc.exists) {
      res.status(404).json({ error: "Pool not found" });
      return;
    }
    const pool = poolDoc.data()!;

    // Check tournament hasn't started
    const tournDoc = await db
      .collection("tournaments")
      .doc(pool.tournamentId)
      .get();
    if (tournDoc.exists && tournDoc.data()!.status !== "upcoming") {
      res.status(400).json({ error: "Tournament has already started" });
      return;
    }

    // Check user doesn't already have a team
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

    // Fetch player docs to validate picks against tiers
    logRouteStep(
      "POST /teams/pools/:poolId/teams",
      req,
      "validating team picks",
      {
        poolId,
        picksCount: picks.length,
      },
    );
    const playerDocs = await Promise.all(
      picks.map((id: string) => db.collection("players").doc(id).get()),
    );

    const missingPlayers = picks.filter(
      (_: string, i: number) => !playerDocs[i].exists,
    );
    if (missingPlayers.length > 0) {
      res
        .status(400)
        .json({ error: `Players not found: ${missingPlayers.join(", ")}` });
      return;
    }

    // Validate all players belong to the pool's tournament
    for (const doc of playerDocs) {
      if (doc.data()!.tournamentId !== pool.tournamentId) {
        res.status(400).json({
          error: `Player ${doc.id} is not in this tournament`,
        });
        return;
      }
    }

    // Validate picks against tier rules
    const pickData = playerDocs.map((doc) => ({
      playerId: doc.id,
      odds: doc.data()!.odds as string,
    }));

    const validation = validatePicks(pickData, pool.tiers);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    // Create team
    logRouteStep(
      "POST /teams/pools/:poolId/teams",
      req,
      "creating team document",
      {
        poolId,
      },
    );
    const teamDoc = await db.collection("teams").add({
      name,
      userId: req.uid,
      poolId,
      picks,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({ id: teamDoc.id });
  },
);

// PUT /teams/:teamId — Update team picks
router.put("/:teamId", requireAuth, async (req: AuthRequest, res) => {
  const { teamId } = req.params;
  const { name, picks } = req.body;
  logRouteAck("PUT /teams/:teamId", req, {
    teamId,
    hasName: Boolean(name),
    picksCount: Array.isArray(picks) ? picks.length : null,
  });

  const teamRef = db.collection("teams").doc(teamId);
  const teamDoc = await teamRef.get();
  if (!teamDoc.exists) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const team = teamDoc.data()!;
  if (team.userId !== req.uid) {
    res.status(403).json({ error: "Not your team" });
    return;
  }

  // Check tournament hasn't started
  const poolDoc = await db.collection("pools").doc(team.poolId).get();
  const pool = poolDoc.data()!;
  const tournDoc = await db
    .collection("tournaments")
    .doc(pool.tournamentId)
    .get();
  if (tournDoc.exists && tournDoc.data()!.status !== "upcoming") {
    res.status(400).json({ error: "Tournament has already started" });
    return;
  }

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (name) updates.name = name;

  if (picks) {
    // Validate new picks
    logRouteStep("PUT /teams/:teamId", req, "validating updated team picks", {
      teamId,
      picksCount: picks.length,
    });
    const playerDocs = await Promise.all(
      picks.map((id: string) => db.collection("players").doc(id).get()),
    );

    for (const doc of playerDocs) {
      if (!doc.exists) {
        res.status(400).json({ error: `Player ${doc.id} not found` });
        return;
      }
      if (doc.data()!.tournamentId !== pool.tournamentId) {
        res
          .status(400)
          .json({ error: `Player ${doc.id} is not in this tournament` });
        return;
      }
    }

    const pickData = playerDocs.map((doc) => ({
      playerId: doc.id,
      odds: doc.data()!.odds as string,
    }));

    const validation = validatePicks(pickData, pool.tiers);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    updates.picks = picks;
  }

  logRouteStep("PUT /teams/:teamId", req, "updating team document", {
    teamId,
    updatedFields: Object.keys(updates),
  });
  await teamRef.update(updates);
  res.json({ success: true });
});

// GET /teams/:teamId — Get team with player details
router.get("/:teamId", requireAuth, async (req: AuthRequest, res) => {
  logRouteAck("GET /teams/:teamId", req, {
    teamId: req.params.teamId,
  });

  const teamDoc = await db.collection("teams").doc(req.params.teamId).get();
  if (!teamDoc.exists) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const team = teamDoc.data()!;
  if (team.userId !== req.uid && !req.admin) {
    res.status(403).json({ error: "Not your team" });
    return;
  }

  const ownerNameByUserId = await loadOwnerNames([team.userId as string]);

  const playerDocs = await Promise.all(
    team.picks.map((id: string) => db.collection("players").doc(id).get()),
  );

  const players = playerDocs
    .map(serializePlayerDetail)
    .filter((player) => player !== null);

  res.json({
    id: teamDoc.id,
    name: team.name,
    userId: team.userId,
    ownerName: ownerNameByUserId.get(team.userId) ?? "Unknown player",
    poolId: team.poolId,
    players,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  });
});

export default router;

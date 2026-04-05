import { Router } from "express";
import { db } from "../config/firebase";
import { AuthRequest, requireAuth, requireAdmin } from "../middleware/auth";
import { fetchScoreboard, matchPlayers } from "../services/espn";
import { FieldValue } from "firebase-admin/firestore";

const router = Router();

// GET /tournaments — List tournaments (any signed-in user).
// Optional ?status=upcoming|active|completed filter. Sorted by startDate asc.
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const statusFilter = req.query.status as string | undefined;
  const validStatuses = ["upcoming", "active", "completed"];

  let query: FirebaseFirestore.Query = db.collection("tournaments");
  if (statusFilter) {
    if (!validStatuses.includes(statusFilter)) {
      res.status(400).json({
        error: `status must be one of ${validStatuses.join(", ")}`,
      });
      return;
    }
    query = query.where("status", "==", statusFilter);
  }

  const snap = await query.get();
  const tournaments = snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        espnEventId: data.espnEventId,
        startDate: data.startDate?.toDate?.()?.toISOString() ?? null,
        endDate: data.endDate?.toDate?.()?.toISOString() ?? null,
        status: data.status,
      };
    })
    // Sort in-memory to avoid requiring a composite index when filtering by status
    .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));

  res.json(tournaments);
});

// GET /tournaments/:tournamentId/players — Player roster for a tournament (any signed-in user).
// Required by the team picker.
router.get(
  "/:tournamentId/players",
  requireAuth,
  async (req: AuthRequest, res) => {
    const { tournamentId } = req.params;

    const tournDoc = await db
      .collection("tournaments")
      .doc(tournamentId)
      .get();
    if (!tournDoc.exists) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    const playersSnap = await db
      .collection("players")
      .where("tournamentId", "==", tournamentId)
      .get();

    const players = playersSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name as string,
          odds: data.odds as string,
          espnMapped: !!data.espnMapped,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json(players);
  },
);

// POST /tournaments — Create tournament (admin only)
router.post("/", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { name, espnEventId, startDate, endDate } = req.body;

  if (!name || !startDate || !endDate) {
    res
      .status(400)
      .json({ error: "name, startDate, and endDate are required" });
    return;
  }

  const doc = await db.collection("tournaments").add({
    name,
    espnEventId: espnEventId || null,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    cutLine: null,
    status: "upcoming",
    createdAt: FieldValue.serverTimestamp(),
  });

  res.status(201).json({ id: doc.id });
});

// POST /tournaments/:tournamentId/players — Bulk add players (admin only)
router.post(
  "/:tournamentId/players",
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const { tournamentId } = req.params;
    const { players } = req.body;

    if (!Array.isArray(players) || players.length === 0) {
      res.status(400).json({ error: "players array is required" });
      return;
    }

    // Verify tournament exists
    const tournDoc = await db.collection("tournaments").doc(tournamentId).get();
    if (!tournDoc.exists) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    const batch = db.batch();
    const ids: string[] = [];

    for (const player of players) {
      if (!player.name || !player.odds) {
        res.status(400).json({ error: "Each player needs name and odds" });
        return;
      }
      const ref = db.collection("players").doc();
      ids.push(ref.id);
      batch.set(ref, {
        name: player.name,
        odds: player.odds,
        tournamentId,
        espnId: null,
        espnMapped: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    res.status(201).json({ playerIds: ids, count: ids.length });
  },
);

// POST /tournaments/:tournamentId/sync-espn — Map players to ESPN IDs (admin only)
router.post(
  "/:tournamentId/sync-espn",
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const { tournamentId } = req.params;

    // Get tournament to check for espnEventId
    const tournDoc = await db.collection("tournaments").doc(tournamentId).get();
    if (!tournDoc.exists) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    // Get our players for this tournament
    const playersSnap = await db
      .collection("players")
      .where("tournamentId", "==", tournamentId)
      .where("espnMapped", "==", false)
      .get();

    if (playersSnap.empty) {
      res.json({
        message: "No unmapped players found",
        matched: [],
        unmatched: [],
      });
      return;
    }

    const ourPlayers = playersSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name as string,
    }));

    // Fetch ESPN data
    const competitors = await fetchScoreboard();
    if (competitors.length === 0) {
      res.status(502).json({ error: "No competitors returned from ESPN" });
      return;
    }

    // Match names
    const { matched, unmatched } = matchPlayers(ourPlayers, competitors);

    // Update matched players in Firestore
    const batch = db.batch();
    for (const m of matched) {
      batch.update(db.collection("players").doc(m.playerId), {
        espnId: m.espnId,
        espnMapped: true,
      });
    }
    await batch.commit();

    res.json({
      matched: matched.length,
      unmatched: unmatched.length,
      matchedPlayers: matched,
      unmatchedPlayers: unmatched,
    });
  },
);

// PUT /players/:playerId/espn-link — Manually link a player to ESPN ID (admin only)
router.put(
  "/players/:playerId/espn-link",
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const { playerId } = req.params;
    const { espnId } = req.body;

    if (!espnId) {
      res.status(400).json({ error: "espnId is required" });
      return;
    }

    const playerRef = db.collection("players").doc(playerId);
    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) {
      res.status(404).json({ error: "Player not found" });
      return;
    }

    await playerRef.update({ espnId, espnMapped: true });
    res.json({ success: true });
  },
);

export default router;

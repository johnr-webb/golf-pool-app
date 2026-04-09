import { Router } from "express";
import { db } from "../config/firebase";
import { AuthRequest, requireAuth, requireAdmin } from "../middleware/auth";
import { fetchScoreboard, fetchScoreboardForEvent, matchPlayers } from "../services/espn";
import { fetchOdds, aggregateOdds } from "../services/odds";
import { FieldValue } from "firebase-admin/firestore";
import { logRouteAck, logRouteError, logRouteStep } from "../utils/logging";

const router = Router();

// GET /tournaments — List tournaments (any signed-in user).
// Optional ?status=upcoming|active|completed filter. Sorted by startDate asc.
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const statusFilter = req.query.status as string | undefined;
  logRouteAck("GET /tournaments", req, {
    statusFilter: statusFilter ?? null,
  });

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
    logRouteAck("GET /tournaments/:tournamentId/players", req, {
      tournamentId,
    });

    const tournDoc = await db.collection("tournaments").doc(tournamentId).get();
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
  logRouteAck("POST /tournaments", req, {
    name: name ?? null,
    hasEspnEventId: Boolean(espnEventId),
  });

  if (!name || !startDate || !endDate) {
    res
      .status(400)
      .json({ error: "name, startDate, and endDate are required" });
    return;
  }

  logRouteStep("POST /tournaments", req, "creating tournament document");
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
    logRouteAck("POST /tournaments/:tournamentId/players", req, {
      tournamentId,
      playersCount: Array.isArray(players) ? players.length : null,
    });

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

    logRouteStep(
      "POST /tournaments/:tournamentId/players",
      req,
      "creating player documents",
      {
        tournamentId,
        playersCount: players.length,
      },
    );
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

// POST /tournaments/:tournamentId/import-odds — Fetch odds from the-odds-api and
// bulk-create players for this tournament (admin only).
// Body: { sportKey: string, apiKey?: string }
// sportKey examples: "golf_masters_tournament_winner", "golf_pga_championship_winner"
// apiKey is optional — falls back to ODDS_API_KEY env var.
router.post(
  "/:tournamentId/import-odds",
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const { tournamentId } = req.params;
    const { sportKey, apiKey } = req.body;
    logRouteAck("POST /tournaments/:tournamentId/import-odds", req, {
      tournamentId,
      sportKey: sportKey ?? null,
      hasApiKey: Boolean(apiKey || process.env.ODDS_API_KEY),
    });

    if (!sportKey) {
      res.status(400).json({ error: "sportKey is required" });
      return;
    }

    const resolvedKey = apiKey || process.env.ODDS_API_KEY;
    if (!resolvedKey) {
      res.status(400).json({
        error:
          "No API key — pass apiKey in the body or set ODDS_API_KEY env var",
      });
      return;
    }

    // Verify tournament exists
    const tournDoc = await db.collection("tournaments").doc(tournamentId).get();
    if (!tournDoc.exists) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    // Check if players already exist for this tournament
    const existingSnap = await db
      .collection("players")
      .where("tournamentId", "==", tournamentId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      res.status(409).json({
        error:
          "Players already exist for this tournament. Delete them first or use the manual bulk endpoint.",
      });
      return;
    }

    // Fetch and aggregate odds
    let events;
    try {
      logRouteStep(
        "POST /tournaments/:tournamentId/import-odds",
        req,
        "fetching odds API data",
        {
          tournamentId,
          sportKey,
        },
      );
      events = await fetchOdds(sportKey, resolvedKey);
    } catch (error) {
      logRouteError(
        "POST /tournaments/:tournamentId/import-odds",
        req,
        "failed to fetch odds API data",
        error,
        { tournamentId, sportKey },
      );
      res.status(502).json({ error: "Failed to fetch odds API data" });
      return;
    }

    if (events.length === 0) {
      res.status(502).json({ error: "No events returned from odds API" });
      return;
    }

    const players = aggregateOdds(events);
    if (players.length === 0) {
      res.status(502).json({ error: "No player odds found in response" });
      return;
    }

    // Batch-write player docs
    logRouteStep(
      "POST /tournaments/:tournamentId/import-odds",
      req,
      "writing imported player odds",
      {
        tournamentId,
        playerCount: players.length,
      },
    );
    const batch = db.batch();
    const ids: string[] = [];

    for (const p of players) {
      const ref = db.collection("players").doc();
      ids.push(ref.id);
      batch.set(ref, {
        name: p.name,
        normalizedName: p.normalizedName,
        odds: p.odds,
        tournamentId,
        espnId: null,
        espnMapped: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    res.status(201).json({
      playerCount: ids.length,
      players: players.map((p, i) => ({
        id: ids[i],
        name: p.name,
        odds: p.odds,
        bookmakerCount: p.bookmakerCount,
      })),
    });
  },
);

// POST /tournaments/:tournamentId/sync-espn — Map players to ESPN IDs (admin only)
router.post(
  "/:tournamentId/sync-espn",
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const { tournamentId } = req.params;
    logRouteAck("POST /tournaments/:tournamentId/sync-espn", req, {
      tournamentId,
    });

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
    let scoreboard;
    try {
      logRouteStep(
        "POST /tournaments/:tournamentId/sync-espn",
        req,
        "fetching ESPN scoreboard",
        {
          tournamentId,
          unmappedPlayers: ourPlayers.length,
        },
      );
      const tournament = tournDoc.data()!;
      scoreboard = tournament.espnEventId
        ? await fetchScoreboardForEvent(tournament.espnEventId)
        : await fetchScoreboard();
    } catch (error) {
      logRouteError(
        "POST /tournaments/:tournamentId/sync-espn",
        req,
        "failed to fetch ESPN scoreboard",
        error,
        { tournamentId },
      );
      res.status(502).json({ error: "Failed to fetch ESPN scoreboard" });
      return;
    }

    if (scoreboard.competitors.length === 0) {
      res.status(502).json({ error: "No competitors returned from ESPN" });
      return;
    }

    // Match names
    const { matched, unmatched } = matchPlayers(ourPlayers, scoreboard.competitors);
    logRouteStep(
      "POST /tournaments/:tournamentId/sync-espn",
      req,
      "matched tournament players to ESPN competitors",
      {
        tournamentId,
        matched: matched.length,
        unmatched: unmatched.length,
      },
    );

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
    logRouteAck("PUT /tournaments/players/:playerId/espn-link", req, {
      playerId,
      hasEspnId: Boolean(espnId),
    });

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

    logRouteStep(
      "PUT /tournaments/players/:playerId/espn-link",
      req,
      "updating manual ESPN link",
      {
        playerId,
        espnId,
      },
    );
    await playerRef.update({ espnId, espnMapped: true });
    res.json({ success: true });
  },
);

export default router;

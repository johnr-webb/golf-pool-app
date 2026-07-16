import { Router } from "express";
import { db } from "../config/firebase";
import { AuthRequest, requireAuth, requireAdmin } from "../middleware/auth";
import {
  fetchScoreboard,
  fetchScoreboardForEvent,
  fetchEventScoreboard,
  matchPlayers,
  normalizeName,
} from "../services/espn";
import { fetchOdds, aggregateOdds } from "../services/odds";
import { FieldValue } from "firebase-admin/firestore";
import { logRouteAck, logRouteError, logRouteStep } from "../utils/logging";

const router = Router();

interface PopulatedPlayer {
  id: string;
  name: string;
  espnId: string;
}

/**
 * Fetch the field for an ESPN event and create a player doc for every
 * competitor that isn't already on the tournament. Players are created with
 * their ESPN athlete id already linked (`espnMapped: true`) and an empty odds
 * string — odds are set separately (manual edit or the-odds-api import).
 *
 * Idempotent: existing players (matched by espnId) are skipped, so it can be
 * re-run to pick up late field additions.
 */
async function populateEspnPlayers(
  tournamentId: string,
  espnEventId: string,
): Promise<{ created: PopulatedPlayer[]; skipped: number }> {
  const scoreboard = await fetchEventScoreboard(espnEventId);

  const existingSnap = await db
    .collection("players")
    .where("tournamentId", "==", tournamentId)
    .get();
  const existingEspnIds = new Set(
    existingSnap.docs.map((d) => d.data().espnId).filter(Boolean),
  );

  const batch = db.batch();
  const created: PopulatedPlayer[] = [];
  let skipped = 0;

  for (const c of scoreboard.competitors) {
    const name = c.athlete?.fullName;
    if (!name || !c.id) continue;
    if (existingEspnIds.has(c.id)) {
      skipped++;
      continue;
    }
    const ref = db.collection("players").doc();
    batch.set(ref, {
      name,
      normalizedName: normalizeName(name),
      odds: "",
      tournamentId,
      espnId: c.id,
      espnMapped: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    created.push({ id: ref.id, name, espnId: c.id });
  }

  if (created.length > 0) {
    await batch.commit();
  }
  return { created, skipped };
}

// GET /tournaments — List tournaments (any signed-in user).
// Optional ?status=upcoming|active|completed filter. Sorted by startDate asc.
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  logRouteAck("GET /tournaments", req, {});

  const snap = await db.collection("tournaments").get();
  const tournaments = snap.docs
    .map((d) => {
      const data = d.data();
      const start: Date | null = data.startDate?.toDate?.() ?? null;
      const end: Date | null = data.endDate?.toDate?.() ?? null;
      return {
        id: d.id,
        name: data.name,
        espnEventId: data.espnEventId,
        startDate: start?.toISOString() ?? null,
        endDate: end?.toISOString() ?? null,
      };
    })
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
  const { name, espnEventId, startDate, endDate, populatePlayers } = req.body;
  logRouteAck("POST /tournaments", req, {
    name: name ?? null,
    hasEspnEventId: Boolean(espnEventId),
    populatePlayers: Boolean(populatePlayers),
  });

  if (!name || !startDate || !endDate) {
    res
      .status(400)
      .json({ error: "name, startDate, and endDate are required" });
    return;
  }

  if (populatePlayers && !espnEventId) {
    res.status(400).json({
      error: "populatePlayers requires espnEventId to fetch the ESPN field",
    });
    return;
  }

  logRouteStep("POST /tournaments", req, "creating tournament document");
  const doc = await db.collection("tournaments").add({
    name,
    espnEventId: espnEventId || null,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    cutLine: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Optionally seed the player roster straight from the ESPN field. Player
  // creation failure must not fail tournament creation — the tournament is
  // already committed — so surface it as a warning instead.
  if (populatePlayers && espnEventId) {
    try {
      logRouteStep("POST /tournaments", req, "populating players from ESPN", {
        tournamentId: doc.id,
        espnEventId,
      });
      const { created } = await populateEspnPlayers(doc.id, espnEventId);
      res.status(201).json({ id: doc.id, playersCreated: created.length });
      return;
    } catch (error) {
      logRouteError(
        "POST /tournaments",
        req,
        "failed to populate players from ESPN",
        error,
        { tournamentId: doc.id, espnEventId },
      );
      res.status(201).json({
        id: doc.id,
        playersCreated: 0,
        warning:
          "Tournament created, but populating players from ESPN failed. " +
          "Retry via POST /tournaments/:id/populate-espn-players.",
      });
      return;
    }
  }

  res.status(201).json({ id: doc.id });
});

// POST /tournaments/:tournamentId/populate-espn-players — Create the player
// roster from the ESPN field for this tournament's espnEventId (admin only).
// Idempotent: already-linked players are skipped. Odds are left blank.
router.post(
  "/:tournamentId/populate-espn-players",
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const { tournamentId } = req.params;
    logRouteAck("POST /tournaments/:tournamentId/populate-espn-players", req, {
      tournamentId,
    });

    const tournDoc = await db.collection("tournaments").doc(tournamentId).get();
    if (!tournDoc.exists) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    // Body espnEventId overrides the stored one (e.g. it wasn't set at create).
    const espnEventId =
      req.body?.espnEventId || tournDoc.data()!.espnEventId;
    if (!espnEventId) {
      res.status(400).json({
        error:
          "Tournament has no espnEventId. Set it on the tournament or pass espnEventId in the body.",
      });
      return;
    }

    let result;
    try {
      logRouteStep(
        "POST /tournaments/:tournamentId/populate-espn-players",
        req,
        "fetching ESPN field and creating players",
        { tournamentId, espnEventId },
      );
      result = await populateEspnPlayers(tournamentId, espnEventId);
    } catch (error) {
      logRouteError(
        "POST /tournaments/:tournamentId/populate-espn-players",
        req,
        "failed to populate players from ESPN",
        error,
        { tournamentId, espnEventId },
      );
      res.status(502).json({ error: "Failed to fetch ESPN field" });
      return;
    }

    if (result.created.length === 0 && result.skipped === 0) {
      res.status(502).json({ error: "No competitors returned from ESPN" });
      return;
    }

    res.status(201).json({
      created: result.created.length,
      skipped: result.skipped,
      players: result.created,
    });
  },
);

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

// POST /tournaments/:tournamentId/import-odds — Fetch odds from the-odds-api for
// this tournament (admin only). Odds are appended to existing players when their
// name matches (e.g. a roster already populated from the ESPN field); unmatched
// odds entries create new players.
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

    // Load existing players so odds can be merged onto them (e.g. a roster
    // already populated from the ESPN field). Match by normalized name, with a
    // unique-last-name fallback for spelling variants ("Matt" vs "Matthew").
    // Players with no odds match are created fresh, same as before.
    const existingSnap = await db
      .collection("players")
      .where("tournamentId", "==", tournamentId)
      .get();

    const existingByNorm = new Map<
      string,
      FirebaseFirestore.QueryDocumentSnapshot
    >();
    const lastNameCounts = new Map<string, number>();
    const existingByLastName = new Map<
      string,
      FirebaseFirestore.QueryDocumentSnapshot
    >();
    for (const d of existingSnap.docs) {
      const data = d.data();
      const norm =
        (data.normalizedName as string) || normalizeName(data.name as string);
      if (!existingByNorm.has(norm)) existingByNorm.set(norm, d);
      const ln = norm.split(" ").pop() ?? "";
      lastNameCounts.set(ln, (lastNameCounts.get(ln) ?? 0) + 1);
      existingByLastName.set(ln, d);
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
    const results: {
      id: string;
      name: string;
      odds: string;
      bookmakerCount: number;
      action: "updated" | "created";
    }[] = [];

    for (const p of players) {
      // Match this odds entry to an existing player: normalized name first,
      // then a unique last name.
      let existing = existingByNorm.get(p.normalizedName);
      if (!existing) {
        const ln = p.normalizedName.split(" ").pop() ?? "";
        if (ln && lastNameCounts.get(ln) === 1) {
          existing = existingByLastName.get(ln);
        }
      }

      if (existing) {
        // Append odds to the existing player, keeping any ESPN link intact.
        batch.update(existing.ref, {
          odds: p.odds,
          normalizedName: p.normalizedName,
        });
        results.push({
          id: existing.id,
          name: existing.data().name as string,
          odds: p.odds,
          bookmakerCount: p.bookmakerCount,
          action: "updated",
        });
      } else {
        const ref = db.collection("players").doc();
        batch.set(ref, {
          name: p.name,
          normalizedName: p.normalizedName,
          odds: p.odds,
          tournamentId,
          espnId: null,
          espnMapped: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        results.push({
          id: ref.id,
          name: p.name,
          odds: p.odds,
          bookmakerCount: p.bookmakerCount,
          action: "created",
        });
      }
    }

    await batch.commit();

    const updated = results.filter((r) => r.action === "updated").length;
    const created = results.filter((r) => r.action === "created").length;
    res.status(201).json({
      playerCount: results.length,
      updated,
      created,
      players: results,
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
    const { matched, unmatched } = matchPlayers(
      ourPlayers,
      scoreboard.competitors,
    );
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

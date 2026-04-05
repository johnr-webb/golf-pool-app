import { Router } from "express";
import * as fs from "fs";
import * as path from "path";
import { db } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";

const router = Router();

// Guard every endpoint in this router with a hard emulator check. The routes
// are only mounted under the emulator guard in index.ts, but we double-gate
// as defense in depth — if someone ever mounts this in prod by accident, all
// routes return 403.
router.use((_req, res, next) => {
  if (process.env.FUNCTIONS_EMULATOR !== "true") {
    res.status(403).json({ error: "Dev endpoints are only available on the emulator" });
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// Sample data loading
// ---------------------------------------------------------------------------

interface SampleCompetitor {
  id: string;
  name: string;
  score: string;
}

/**
 * Load real PGA player data from plan/sample_data.json. The file is an ESPN
 * scoreboard response from the Valero Texas Open (event 401811940) with 132
 * competitors — we use the first N sorted by the order ESPN returned them
 * (which is already leaderboard order — position 1 is first).
 */
function loadSampleCompetitors(): SampleCompetitor[] {
  const fixturePath = process.env.ESPN_FIXTURE_PATH ?? "../plan/sample_data.json";
  const resolved = path.isAbsolute(fixturePath)
    ? fixturePath
    : path.resolve(process.cwd(), fixturePath);
  const raw = fs.readFileSync(resolved, "utf8");
  const cleaned = raw.replace(/,(\s*[}\]])/g, "$1");
  const data = JSON.parse(cleaned) as {
    events: Array<{
      competitions: Array<{
        competitors: Array<{
          id: string;
          athlete: { fullName: string };
          score: string;
        }>;
      }>;
    }>;
  };
  const competitors = data.events[0].competitions[0].competitors;
  return competitors.map((c) => ({
    id: c.id,
    name: c.athlete.fullName,
    score: c.score,
  }));
}

// Synthetic odds for each leaderboard position. These buckets line up with
// the pool's 3-tier config (+100..+500, +501..+2000, +2001..+9999) so that
// exactly 4/10/10 players populate tiers 1/2/3.
const SYNTHETIC_ODDS = [
  // Tier 1: positions 1-4, shortest odds (favorites)
  "+200", "+300", "+400", "+500",
  // Tier 2: positions 5-14
  "+750", "+900", "+1100", "+1300", "+1500", "+1650", "+1750", "+1850", "+1950", "+2000",
  // Tier 3: positions 15-24
  "+2500", "+3000", "+3500", "+4000", "+4500", "+5000", "+6000", "+7000", "+8000", "+9000",
];

const POOL_TIERS = [
  { tierNumber: 1, oddsMin: "+100", oddsMax: "+500", picksRequired: 2 },
  { tierNumber: 2, oddsMin: "+501", oddsMax: "+2000", picksRequired: 2 },
  { tierNumber: 3, oddsMin: "+2001", oddsMax: "+9999", picksRequired: 2 },
];

const SCORING_RULE = { countBest: 4, outOf: 6 };

// ---------------------------------------------------------------------------
// POST /dev/reset — wipe all app collections
// ---------------------------------------------------------------------------

router.post("/reset", async (_req, res) => {
  const collections = ["users", "tournaments", "players", "pools", "teams"];
  for (const name of collections) {
    const snap = await db.collection(name).get();
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    if (snap.docs.length > 0) await batch.commit();
  }
  res.json({ message: "All collections cleared" });
});

// ---------------------------------------------------------------------------
// POST /dev/seed — create the full fixture scenario
//
// Creates:
//   - Tournament A: "Valero Texas Open (Sample)" — status ACTIVE, espnEventId
//     401811940, 24 players pre-mapped to real ESPN IDs (matches fixture).
//   - Tournament B: "Sunday Demo Open" — status UPCOMING, 18 players, no
//     ESPN mapping (doesn't need live scoring). Lets users exercise the
//     team picker create flow.
//   - Pool A linked to Tournament A with teams pre-seeded for adminUid/userUid
//     if provided. Shows a populated live leaderboard immediately.
//   - Pool B linked to Tournament B with NO teams. Lets users test team creation.
//
// Body (all optional): { adminUid?: string, userUid?: string }
// ---------------------------------------------------------------------------

router.post("/seed", async (req, res) => {
  const { adminUid, userUid } = (req.body ?? {}) as {
    adminUid?: string;
    userUid?: string;
  };

  const competitors = loadSampleCompetitors();
  if (competitors.length < 24) {
    res.status(500).json({
      error: `Sample data only has ${competitors.length} competitors, need at least 24`,
    });
    return;
  }

  // -------------------------------------------------------------------------
  // Tournament A — Active, mirrors sample_data.json
  // -------------------------------------------------------------------------
  const tournARef = db.collection("tournaments").doc();
  await tournARef.set({
    name: "Valero Texas Open (Sample)",
    espnEventId: "401811940",
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-04-05"),
    cutLine: null,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
  });

  // Pick the top 24 competitors, assign synthetic odds, pre-map espnId.
  const tournAPlayers: { id: string; name: string; odds: string; espnId: string }[] = [];
  const batchA = db.batch();
  for (let i = 0; i < 24; i++) {
    const c = competitors[i];
    const ref = db.collection("players").doc();
    batchA.set(ref, {
      name: c.name,
      odds: SYNTHETIC_ODDS[i],
      tournamentId: tournARef.id,
      espnId: c.id,
      espnMapped: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    tournAPlayers.push({ id: ref.id, name: c.name, odds: SYNTHETIC_ODDS[i], espnId: c.id });
  }
  await batchA.commit();

  const poolARef = db.collection("pools").doc();
  await poolARef.set({
    name: "The Masters Showdown",
    password: "letmein",
    tournamentId: tournARef.id,
    createdBy: adminUid ?? "seed-script",
    tiers: POOL_TIERS,
    scoringRule: SCORING_RULE,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Seeded team picks — indices into tournAPlayers array. Each picks 2 per tier.
  // Admin picks positions 1,4 | 5,10 | 15,20 (0-indexed: 0,3,4,9,14,19)
  // User picks positions 2,3 | 6,11 | 16,21  (0-indexed: 1,2,5,10,15,20)
  const adminPickIdx = [0, 3, 4, 9, 14, 19];
  const userPickIdx = [1, 2, 5, 10, 15, 20];

  const seededTeams: { teamId: string; userId: string; name: string }[] = [];

  if (adminUid) {
    const teamRef = db.collection("teams").doc();
    await teamRef.set({
      name: "Admin Picks",
      userId: adminUid,
      poolId: poolARef.id,
      picks: adminPickIdx.map((i) => tournAPlayers[i].id),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    seededTeams.push({ teamId: teamRef.id, userId: adminUid, name: "Admin Picks" });
  }

  if (userUid) {
    const teamRef = db.collection("teams").doc();
    await teamRef.set({
      name: "User Picks",
      userId: userUid,
      poolId: poolARef.id,
      picks: userPickIdx.map((i) => tournAPlayers[i].id),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    seededTeams.push({ teamId: teamRef.id, userId: userUid, name: "User Picks" });
  }

  // -------------------------------------------------------------------------
  // Tournament B — Upcoming, lets users test team creation flow
  // -------------------------------------------------------------------------
  const tournBRef = db.collection("tournaments").doc();
  const startB = new Date();
  startB.setDate(startB.getDate() + 7);
  const endB = new Date(startB);
  endB.setDate(endB.getDate() + 3);

  await tournBRef.set({
    name: "Sunday Demo Open",
    espnEventId: null,
    startDate: startB,
    endDate: endB,
    cutLine: null,
    status: "upcoming",
    createdAt: FieldValue.serverTimestamp(),
  });

  // Reuse next 18 competitors from the sample file with fresh synthetic odds
  // spread across the same 3 tiers (6 per tier, picksRequired stays 2/2/2 —
  // plenty of choice for picking).
  const tournBOdds = [
    "+150", "+250", "+350", "+450", "+500", "+500",           // Tier 1 (6 players)
    "+600", "+800", "+1000", "+1500", "+1800", "+2000",       // Tier 2 (6 players)
    "+2500", "+3500", "+4500", "+6000", "+7500", "+9000",     // Tier 3 (6 players)
  ];
  const batchB = db.batch();
  for (let i = 0; i < 18; i++) {
    const c = competitors[24 + i];
    const ref = db.collection("players").doc();
    batchB.set(ref, {
      name: c.name,
      odds: tournBOdds[i],
      tournamentId: tournBRef.id,
      espnId: null,
      espnMapped: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batchB.commit();

  const poolBRef = db.collection("pools").doc();
  await poolBRef.set({
    name: "Demo Pool (Open for Picks)",
    password: "letmein",
    tournamentId: tournBRef.id,
    createdBy: adminUid ?? "seed-script",
    tiers: POOL_TIERS,
    scoringRule: SCORING_RULE,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // -------------------------------------------------------------------------
  // Response
  // -------------------------------------------------------------------------
  res.status(201).json({
    message: "Seed complete",
    summary: {
      tournaments: 2,
      players: 42,
      pools: 2,
      teams: seededTeams.length,
    },
    tournaments: {
      active: {
        id: tournARef.id,
        name: "Valero Texas Open (Sample)",
        status: "active",
        espnEventId: "401811940",
      },
      upcoming: {
        id: tournBRef.id,
        name: "Sunday Demo Open",
        status: "upcoming",
      },
    },
    pools: {
      active: {
        id: poolARef.id,
        name: "The Masters Showdown",
        password: "letmein",
      },
      upcoming: {
        id: poolBRef.id,
        name: "Demo Pool (Open for Picks)",
        password: "letmein",
      },
    },
    seededTeams,
    samplePickIds: {
      description:
        "If you want to manually POST a team, here are 6 valid player IDs covering all 3 tiers of the active pool",
      picks: adminPickIdx.map((i) => tournAPlayers[i].id),
    },
  });
});

export default router;

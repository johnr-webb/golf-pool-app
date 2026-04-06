# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Golf pool app: groups pick PGA tournament golfers across odds-based tiers, and scores are pulled from ESPN's public scoreboard API. Firebase project is `golf-pool-app-492300`. The canonical design doc lives at `plan/PLAN_V3.md` and `docs/PLAN_V2.md` — read `PLAN_V3.md` before making architectural changes.

## Stack

**Backend** (`functions/`):
- Firebase Cloud Functions (Node 22, TypeScript) behind a single Express app exported as `api`
- Firestore (NoSQL) — collections: `users`, `tournaments`, `players`, `pools`, `teams`
- Firebase Auth — ID tokens verified via `requireAuth`/`requireAdmin` middleware; admin flag lives in `users/{uid}.admin`

**Frontend** (`web/`):
- Next.js 15 App Router + React 19 + TypeScript
- Mantine v7 (`@mantine/core`, `@mantine/form`, `@mantine/hooks`, `@mantine/notifications`)
- Firebase Auth client SDK scoped to **auth only** — sign-in, sign-up, sign-out, `getIdToken()`. Firestore/Storage client SDKs are NOT used; all data access flows through the Express API via `web/lib/api/client.ts`. This is an intentional architectural constraint — do not add direct Firestore reads from the frontend.
- Deployed via **Firebase App Hosting** (not Vercel). Config at `web/apphosting.yaml`. The `NEXT_PUBLIC_FIREBASE_API_KEY` and `NEXT_PUBLIC_FIREBASE_APP_ID` env vars are sourced from Secret Manager.

Backend source lives under `functions/` (that's `firebase.json`'s `source` dir). Frontend source lives under `web/`. Run backend commands from `functions/` and frontend commands from `web/`.

## Common Commands

```bash
# Build TS → lib/ (required before emulator/deploy; firebase.json predeploy hook also runs it)
cd functions && npm run build

# Start the full local emulator suite (functions, firestore, auth, UI on :4000)
firebase emulators:start
# or: cd functions && npm run serve   (build + emulator functions only)

# Seed local emulator users (admin@test.com / user@test.com, password123) and print ID tokens
./scripts/local-dev-setup.sh

# Deploy functions to the configured Firebase project
cd functions && npm run deploy

# Frontend: install, run dev server, typecheck, production build
cd web && npm install
cd web && npm run dev          # Next dev server on :3000, talks to the functions emulator
cd web && npm run typecheck
cd web && npm run build

# Deploy frontend to Firebase App Hosting (one-time setup: firebase apphosting:backends:create)
firebase deploy --only apphosting
```

Emulator ports: functions `5001`, firestore `8080`, auth `9099`, UI `4000`. Local API base URL:
`http://127.0.0.1:5001/golf-pool-app-492300/us-central1/api`. Frontend dev server: `http://localhost:3000`. Copy `web/.env.example` to `web/.env.local` before first run.

There is **no test runner configured yet** — `plan/PLAN_V3.md` calls out the unit tests that should exist (ESPN name matching, leaderboard scoring, tier validation) but none have been wired up. Don't invent a `npm test` command; add the harness if tests are needed.

## Architecture

### Single Express app, single Cloud Function
`functions/src/index.ts` mounts all route modules on one Express app and exports it as `export const api = functions.https.onRequest(app)`. Every endpoint is reached via `/api/<route>`. When adding a new route module, register it here.

Note: `functions/src/routes/dev.ts` exists with `/dev/seed` and `/dev/reset` emulator-only endpoints but is **not currently mounted** in `index.ts`. Mount it (guarded by `FUNCTIONS_EMULATOR`) if you need those endpoints.

### Auth middleware contract
`middleware/auth.ts` exposes `requireAuth` and `requireAdmin`:
- `requireAuth` verifies the `Authorization: Bearer <idToken>` header via `auth.verifyIdToken`, attaches `req.uid` and `req.admin`, and **auto-creates a `users/{uid}` doc with `admin: false` on first call**. Admin status lives in Firestore (`users/{uid}.admin`), not in custom claims — promote users by flipping that field directly (the local-dev-setup script does this for `admin@test.com`).
- `requireAdmin` must always follow `requireAuth`. Routes like tournament creation and player import are admin-gated.

### ESPN integration (two-phase handshake)
Players and odds are entered manually before ESPN publishes the field, so ESPN athlete IDs are wired up separately:
1. **Pre-tournament sync** (`POST /tournaments/:id/sync-espn`) — `services/espn.ts` fetches the PGA scoreboard, normalizes names (NFD accent strip + lowercase, see `normalizeName`), fuzzy-matches against our `players` collection, and fills in `espnId` / `espnMapped`. Unmatched players are returned in the response for manual linking via `PUT /players/:id/espn-link`.
2. **Live scoring** — `GET /pools/:id/leaderboard` fetches the scoreboard on demand and joins by `espnId`.

ESPN endpoint: `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard` (optionally `?event=<espnEventId>`). Competitors live at `events[0].competitions[0].competitors[]`. A recorded response sample is at `plan/sample_data.json` and the full schema is at `docs/schema-3-5.json` — use these for offline testing instead of hitting ESPN during dev.

### Leaderboard scoring rules
`services/leaderboard.ts` implements the pool scoring. Two rules that are easy to get wrong:
- **Missed-cut penalty**: any picked player who missed the cut is assigned the **worst score among players who made the cut** (not DQ, not a fixed penalty).
- **Best-N-of-M**: each pool defines `scoringRule: { countBest, outOf }` (e.g. count best 4 of 6 picks). Sum those N scores, rank low-to-high.

### Tier validation
Pool creators define `tiers[]` with `oddsMin`, `oddsMax`, and `picksRequired`. `services/validation.ts` enforces that a team's picks satisfy each tier's `picksRequired` count based on each player's stored `odds` string. This runs on team create/update — updates are only allowed while the tournament is `upcoming`.

### Firestore data shapes
Authoritative shapes are in `plan/PLAN_V3.md` § "Firestore Data Model" and mirrored in `functions/src/types/index.ts`. Key cross-doc references: `players.tournamentId`, `pools.tournamentId`, `teams.poolId` + `teams.userId` (Firebase Auth UID), `teams.picks` (array of player doc IDs).

## API documentation

- `docs/openapi.yaml` is the OpenAPI spec for the HTTP surface — keep it in sync when routes change.
- `postman/` contains a Postman collection that consumes the local dev tokens printed by `local-dev-setup.sh`.
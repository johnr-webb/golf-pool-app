# Golf Pool App

Backend and frontend for a golf pool app: groups pick PGA tournament golfers across odds-based tiers, scores are pulled from ESPN's public scoreboard API.

Firebase project: `golf-pool-app-492300`

## Repo layout

```
functions/  — Firebase Cloud Functions (Express, TypeScript). Single HTTP function exported as `api`.
web/        — Next.js 15 App Router frontend, deployed via Firebase App Hosting.
docs/       — OpenAPI spec (`openapi.yaml`) — authoritative for the HTTP surface.
plan/       — Design docs (`PLAN_V3.md`) and `sample_data.json` (real ESPN scoreboard dump used for local testing).
scripts/    — Local dev helpers.
```

Design docs: start with `plan/PLAN_V3.md`. Backend guidance for AI tools lives in `CLAUDE.md`.

## Stack

- **Backend**: Firebase Cloud Functions (Node 18, TypeScript) + Firestore + Firebase Auth. Single Express app mounted at `/api/*`.
- **Frontend**: Next.js 15 + React 19 + Mantine v7. Firebase Auth client SDK is scoped to auth only — **all app data flows through the Express API**, never directly from the frontend to Firestore.
- **Hosting**: Firebase App Hosting for the frontend, Cloud Functions for the backend. Single `firebase deploy` pipeline.

## Local testing

This project has full auto-seed infrastructure for local development. After the first-time setup, getting a fully populated environment takes **three commands in three terminals**.

### First-time setup (run once)

```bash
# Install backend deps
cd functions && npm install

# Install frontend deps
cd ../web && npm install

# Copy the frontend env template — no real Firebase credentials needed because
# the auth emulator accepts any API key
cp .env.example .env.local
```

### Running the local stack

You need three terminals open. None of these commands run in the background.

**Terminal 1 — Firebase emulators**

```bash
cd functions && npm run build
cd .. && firebase emulators:start
```

Wait for `All emulators ready!`. Ports: functions `5001`, firestore `8080`, auth `9099`, emulator UI `4000`.

**Terminal 2 — Auto-seed**

```bash
./scripts/local-dev-setup.sh
```

This script does everything needed to get you testable data:

1. Creates two Firebase Auth users: `admin@test.com` and `user@test.com` (both `password123`)
2. Promotes the admin user by writing `users/{uid}.admin = true` directly to Firestore
3. Wipes all app collections via `POST /dev/reset`
4. Seeds a full fixture scenario via `POST /dev/seed`:
   - **Tournament 1** — "Valero Texas Open (Sample)", status **active**, sourced from `plan/sample_data.json` (a real ESPN scoreboard dump with 132 competitors). The top 24 become our roster with synthetic odds spanning three tiers and ESPN IDs pre-mapped — no `sync-espn` dance needed.
   - **Tournament 2** — "Sunday Demo Open", status **upcoming**, 18 players. Lets you test the team picker create flow.
   - **Pool A** ("The Masters Showdown") linked to Tournament 1, with teams already created for both seeded users. Pool password: `letmein`.
   - **Pool B** ("Demo Pool (Open for Picks)") linked to Tournament 2, empty and ready for picks. Pool password: `letmein`.

Re-run this script any time you want a fresh slate.

**Terminal 3 — Frontend**

```bash
cd web && npm run dev
```

Wait for `Ready`. Frontend lives at `http://localhost:3000`.

### Try it

1. Open [http://localhost:3000](http://localhost:3000)
2. Sign in as `user@test.com` / `password123`
3. You'll land on `/pools` with both pools visible
4. Click **"The Masters Showdown"** to see the populated live leaderboard — real scores from `sample_data.json` (Robert MacIntyre at -14, Ludvig Åberg at -10, etc.) with your team already scoring
5. Click **"Demo Pool"** to exercise the pool detail page. Click "Create team" to test the tier-gated picker flow end-to-end.
6. Open a second browser profile signed in as `admin@test.com` to test the multi-user experience.

### ESPN fixture mode

When running under the emulator, `functions/src/services/espn.ts` reads scoreboard data from `plan/sample_data.json` instead of calling the live ESPN API. This means:

- `GET /pools/:id/leaderboard` renders real scores offline — no network needed
- You can flip Tournament 2's `status` to `active` in the Firestore emulator UI and immediately see a leaderboard (it'll show the same Valero scores, which is fine for dev)
- Production deploys always hit the live ESPN API. The fixture loader is gated on `FUNCTIONS_EMULATOR=true` and never activates in prod.

Override the fixture path with the `ESPN_FIXTURE_PATH` env var if you want to point at a different dump.

### Testing the edit-lock flow

Team picks are only editable while a tournament is in `upcoming` status. To test the lock:

1. Go to the Firestore emulator UI: [http://localhost:4000/firestore](http://localhost:4000/firestore)
2. Navigate to `tournaments/<tournamentB_id>` (Sunday Demo Open)
3. Change the `status` field from `upcoming` to `active`
4. Refresh `/pools/<poolB_id>/team/edit` in the app — you should see the yellow "Picks locked" banner and disabled inputs

### Postman users

The script prints the admin and user ID tokens at the end of its output. Copy them into your Postman environment variables as `admin_token` and `user_token`. The OpenAPI spec at `docs/openapi.yaml` can be imported directly into Postman to get all routes pre-configured.

### Troubleshooting

- **"ERROR: Firebase emulators are not running"** from the seed script → start emulators in terminal 1 first.
- **Seed fails with "sample data only has N competitors"** → `plan/sample_data.json` was modified or truncated. Check git status.
- **401 on every API call from the frontend** → verify the emulator auth URL in `web/lib/firebase/client.ts:26` matches your emulator config (default `http://127.0.0.1:9099`).
- **Leaderboard shows "Failed to fetch ESPN scores"** → the fixture loader's guard check failed. Verify `FUNCTIONS_EMULATOR=true` is set in the emulator environment (it is automatically; only fails if you're running `node lib/index.js` directly).
- **Need to nuke everything** → stop all terminals, delete any `emulator-data/` directory if you've been using `--import`/`--export-on-exit`, then restart from terminal 1.

## Deploying

- **Backend**: `cd functions && npm run deploy`
- **Frontend**: `firebase deploy --only apphosting` (requires one-time `firebase apphosting:backends:create` pointing at `web/`)

See `CLAUDE.md` for architectural notes and `docs/openapi.yaml` for the full API surface.

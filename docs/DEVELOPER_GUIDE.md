# Golf Pool App - Developer Guide

## Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd golf-pool-app

# 2. Setup frontend
cd web && npm install
cp .env.example .env.local

# 3. Setup backend
cd ../functions && npm install

# 4. Start emulators (includes seeding)
firebase emulators:start

# 5. Open frontend
open http://localhost:3000
```

## Development Workflow

### Starting Local Development

```bash
# Start all emulators (functions, firestore, auth, UI)
firebase emulators:start

# Or start just the functions emulator
cd functions && npm run serve

# Frontend dev server (talks to emulators)
cd web && npm run dev
```

### Testing as Admin

The `local-dev-setup.sh` script seeds admin credentials:

```bash
./scripts/local-dev-setup.sh
# Output:
# Admin: admin@test.com / password123
# User: user@test.com / password123
```

### Making Changes

1. **Backend changes** (`functions/src/`):

   ```bash
   cd functions
   npm run build      # TypeScript → lib/
   # Changes auto-reload with emulator
   ```

2. **Frontend changes** (`web/`):

   ```bash
   cd web
   npm run dev        # Hot reload enabled
   ```

3. **Type checking**:
   ```bash
   cd web && npm run typecheck
   cd functions && npm run typecheck
   ```

### Building for Production

```bash
# Backend
cd functions && npm run build && npm run deploy

# Frontend — Firebase App Hosting deploys automatically on git push to the linked branch.
# To trigger a manual rollout:
firebase apphosting:rollouts:create <backend-id>
# To find your backend ID:
firebase apphosting:backends:list
```

## Common Tasks

### Creating a Tournament

1. Sign in as admin
2. Navigate to `/pools/new`
3. Fill in tournament details:
   - Name: "The Masters 2026"
   - ESPN Event ID: from ESPN URL or `docs/schema-3-5.json`
   - Start/End dates
4. Save

To also pull the player roster from ESPN at creation time, pass
`populatePlayers: true` (requires `espnEventId`) — see the scripted flow below.

### Adding Players

Two approaches:

- **ESPN-first (recommended once ESPN has published the field):** create the
  roster straight from the ESPN field, then layer odds on. Players are created
  with their ESPN athlete id already linked, so no separate sync step is needed.
- **Manual:** bulk add players with odds, then trigger ESPN sync to link ids.

See `docs/ESPN_INTEGRATION.md` for the full flow and endpoint details.

### Importing a New Tournament (ESPN-first, scripted)

`scripts/import-the-open.sh` runs the whole ESPN-first flow end to end:
create tournament + populate players from ESPN, then append odds from
the-odds-api. Event metadata comes from `data/the_open_roster.json` (adapt/copy
for other events).

```bash
API_BASE="http://127.0.0.1:5001/golf-pool-app-492300/us-central1/api" \
ADMIN_TOKEN="<admin-id-token>" \
ODDS_API_KEY="<the-odds-api-key>" \
  ./scripts/import-the-open.sh
```

### Importing Odds (onto an existing roster)

Appends odds to existing players by name match (unmatched entries create new
players). Safe to run against an ESPN-populated roster.

```bash
curl -X POST http://localhost:5001/.../tournaments/:id/import-odds \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"sportKey": "golf_the_open_championship_winner"}'
```

### Manual ESPN Linking

If auto-sync fails for some players:

```bash
curl -X PUT http://localhost:5001/.../tournaments/players/:playerId/espn-link \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"espnId": "3448"}'
```

## Testing the API

### With Postman

Import `postman/golf-pool-app.json` collection.

### With cURL

```bash
# Get admin token
TOKEN=$(./scripts/local-dev-setup.sh | grep "Admin Token" | cut -d: -f2)

# List tournaments
curl http://localhost:5001/.../tournaments \
  -H "Authorization: Bearer $TOKEN"

# Create tournament
curl -X POST http://localhost:5001/.../tournaments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Tournament",
    "startDate": "2026-04-10T00:00:00Z",
    "endDate": "2026-04-13T00:00:00Z"
  }'
```

## Debugging

### Viewing Emulator Logs

```bash
firebase emulators:start --only functions
# Logs appear in terminal
```

### Checking Firestore Data

Open http://localhost:4000 (Emulator UI)

### Checking Auth Emulator

Open http://localhost:4000 (same UI)

### Common Issues

**Frontend not connecting to emulator:**

- Check `NEXT_PUBLIC_USE_EMULATOR` in `.env.local`
- Verify API base URL matches emulator port (5001)

**ESPN sync returns 0 matches:**

- Ensure tournament has `espnEventId` set
- Check emulator is reading fixture (`FUNCTIONS_EMULATOR=true`)

**Session cookie not working:**

- Ensure `__session` cookie name (Firebase App Hosting requirement)
- Check cookie flags: HttpOnly, Secure, SameSite=Lax

## File Locations

| What             | Where                          |
| ---------------- | ------------------------------ |
| Backend source   | `functions/src/`               |
| Frontend source  | `web/`                         |
| API spec         | `docs/openapi.yaml`            |
| Design docs      | `plan/PLAN_V3.md`              |
| ESPN fixture     | `plan/sample_data.json`        |
| TypeScript types | `functions/src/types/index.ts` |

## Architecture Reminders

1. **No Firestore from frontend** - All data via API
2. **Single Cloud Function** - All routes on one export
3. **Session cookie name** - MUST be `__session`
4. **Admin in Firestore** - Not custom claims
5. **Emulator fixture mode** - Uses `plan/sample_data.json`

## Deployment Checklist

- [ ] TypeScript builds pass (`npm run build`)
- [ ] All env vars set in Secret Manager
- [ ] Emulator tests pass
- [ ] ESLint passes
- [ ] No console errors in browser
- [ ] Admin user promoted in production Firestore

## Getting Help

- Design doc: `plan/PLAN_V3.md`
- API spec: `docs/openapi.yaml`
- Schema: `docs/DATA_MODEL.md`

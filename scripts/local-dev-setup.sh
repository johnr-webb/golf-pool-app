#!/bin/bash
# Local dev setup — creates test users and prints tokens for Postman
# ONLY works against the local emulators, never touches prod

set -e

AUTH_URL="http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1"
API_URL="http://127.0.0.1:5001/golf-pool-app-492300/us-central1/api"
API_KEY="fake-api-key"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check emulators are running
if ! curl -s http://127.0.0.1:4000 > /dev/null 2>&1; then
  echo "ERROR: Firebase emulators are not running."
  echo "Start them first: cd functions && npm run build && cd .. && firebase emulators:start"
  exit 1
fi

echo -e "${GREEN}=== Firebase Emulators Detected ===${NC}"
echo ""

# Create admin user
echo -e "${YELLOW}Creating admin user...${NC}"
ADMIN_RESPONSE=$(curl -s -X POST "${AUTH_URL}/accounts:signUp?key=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "password123",
    "returnSecureToken": true
  }')

ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('idToken','FAILED'))" 2>/dev/null)
ADMIN_UID=$(echo "$ADMIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('localId','FAILED'))" 2>/dev/null)

if [ "$ADMIN_TOKEN" = "FAILED" ]; then
  # User might already exist, try sign in
  ADMIN_RESPONSE=$(curl -s -X POST "${AUTH_URL}/accounts:signInWithPassword?key=${API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "admin@test.com",
      "password": "password123",
      "returnSecureToken": true
    }')
  ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('idToken','FAILED'))" 2>/dev/null)
  ADMIN_UID=$(echo "$ADMIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('localId','FAILED'))" 2>/dev/null)
fi

# Create regular user
echo -e "${YELLOW}Creating regular user...${NC}"
USER_RESPONSE=$(curl -s -X POST "${AUTH_URL}/accounts:signUp?key=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "password123",
    "returnSecureToken": true
  }')

USER_TOKEN=$(echo "$USER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('idToken','FAILED'))" 2>/dev/null)
USER_UID=$(echo "$USER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('localId','FAILED'))" 2>/dev/null)

if [ "$USER_TOKEN" = "FAILED" ]; then
  USER_RESPONSE=$(curl -s -X POST "${AUTH_URL}/accounts:signInWithPassword?key=${API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "user@test.com",
      "password": "password123",
      "returnSecureToken": true
    }')
  USER_TOKEN=$(echo "$USER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('idToken','FAILED'))" 2>/dev/null)
  USER_UID=$(echo "$USER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('localId','FAILED'))" 2>/dev/null)
fi

# Wipe all app collections before re-seeding. This runs AFTER user creation
# (auth emulator is separate from Firestore), so auth users are preserved.
echo -e "${YELLOW}Resetting Firestore collections...${NC}"
curl -s -X POST "${API_URL}/dev/reset" > /dev/null

# Set admin user's admin flag in Firestore emulator. Must run AFTER /dev/reset
# because the reset wipes the users collection. Without this, admin routes
# like POST /tournaments will 403 even with the admin token.
echo -e "${YELLOW}Setting admin flag in Firestore...${NC}"
curl -s -X POST "http://127.0.0.1:8080/v1/projects/golf-pool-app-492300/databases/(default)/documents/users?documentId=${ADMIN_UID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"fields\": {
      \"email\": {\"stringValue\": \"admin@test.com\"},
      \"displayName\": {\"stringValue\": \"Test Admin\"},
      \"realName\": {\"stringValue\": \"Tess Admin\"},
      \"admin\": {\"booleanValue\": true},
      \"createdAt\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
    }
  }" > /dev/null 2>&1

# Seed the regular user's Firestore doc too so /users/mine returns a populated
# realName on first sign-in instead of an empty string. Non-admin.
curl -s -X POST "http://127.0.0.1:8080/v1/projects/golf-pool-app-492300/databases/(default)/documents/users?documentId=${USER_UID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"fields\": {
      \"email\": {\"stringValue\": \"user@test.com\"},
      \"displayName\": {\"stringValue\": \"Regular Reggie\"},
      \"realName\": {\"stringValue\": \"Reggie User\"},
      \"admin\": {\"booleanValue\": false},
      \"createdAt\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
    }
  }" > /dev/null 2>&1

# Auto-seed two tournaments (one active with live sample scores, one upcoming),
# two pools, and pre-made teams for both users in the active pool.
echo -e "${YELLOW}Seeding tournaments, players, pools, and teams...${NC}"
SEED_RESPONSE=$(curl -s -X POST "${API_URL}/dev/seed" \
  -H "Content-Type: application/json" \
  -d "{\"adminUid\":\"${ADMIN_UID}\",\"userUid\":\"${USER_UID}\"}")

ACTIVE_POOL_ID=$(echo "$SEED_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pools',{}).get('active',{}).get('id','FAILED'))" 2>/dev/null || echo "FAILED")
UPCOMING_POOL_ID=$(echo "$SEED_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pools',{}).get('upcoming',{}).get('id','FAILED'))" 2>/dev/null || echo "FAILED")

if [ "$ACTIVE_POOL_ID" = "FAILED" ]; then
  echo -e "\033[0;31mERROR: Seed failed.${NC} Response:"
  echo "$SEED_RESPONSE"
  exit 1
fi

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "API Base URL: ${API_URL}"
echo "Frontend:     http://localhost:3000 (run: cd web && npm run dev)"
echo ""
echo "-------------------------------------------"
echo "ADMIN USER (admin@test.com / password123)"
echo "  UID:   ${ADMIN_UID}"
echo "-------------------------------------------"
echo "REGULAR USER (user@test.com / password123)"
echo "  UID:   ${USER_UID}"
echo "-------------------------------------------"
echo ""
echo -e "${GREEN}Seeded data:${NC}"
echo "  - Tournament 1: Valero Texas Open (Sample) — ACTIVE, real scores from sample_data.json"
echo "  - Tournament 2: Sunday Demo Open — UPCOMING, lets you test team creation"
echo "  - Active pool:   ${ACTIVE_POOL_ID}  (both users already have teams)"
echo "  - Upcoming pool: ${UPCOMING_POOL_ID}  (empty, ready for picks)"
echo "  - Pool password: letmein"
echo ""
echo -e "${GREEN}Try it now:${NC}"
echo "  1. Open http://localhost:3000"
echo "  2. Sign in as user@test.com / password123"
echo "  3. You'll see both pools on the landing page"
echo "  4. Click 'The Masters Showdown' to see the populated live leaderboard"
echo "  5. Click 'Demo Pool' to test creating a team"
echo ""
echo -e "${YELLOW}Reset and re-seed anytime with:${NC}"
echo "  ./scripts/local-dev-setup.sh"
echo ""
echo -e "${YELLOW}For Postman (admin token):${NC}"
echo "  ${ADMIN_TOKEN}"
echo ""
echo -e "${YELLOW}For Postman (user token):${NC}"
echo "  ${USER_TOKEN}"

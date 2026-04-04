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

# Set admin user's admin flag in Firestore emulator
echo -e "${YELLOW}Setting admin flag in Firestore...${NC}"
curl -s -X POST "http://127.0.0.1:8080/v1/projects/golf-pool-app-492300/databases/(default)/documents/users?documentId=${ADMIN_UID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"fields\": {
      \"email\": {\"stringValue\": \"admin@test.com\"},
      \"displayName\": {\"stringValue\": \"Test Admin\"},
      \"admin\": {\"booleanValue\": true},
      \"createdAt\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
    }
  }" > /dev/null 2>&1

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "API Base URL: ${API_URL}"
echo ""
echo "-------------------------------------------"
echo "ADMIN USER (admin@test.com)"
echo "  UID:   ${ADMIN_UID}"
echo "  Token: ${ADMIN_TOKEN}"
echo "-------------------------------------------"
echo "REGULAR USER (user@test.com)"
echo "  UID:   ${USER_UID}"
echo "  Token: ${USER_TOKEN}"
echo "-------------------------------------------"
echo ""
echo -e "${YELLOW}Postman setup:${NC}"
echo "  1. Set a variable: base_url = ${API_URL}"
echo "  2. Set a variable: admin_token = <token above>"
echo "  3. Set a variable: user_token = <token above>"
echo "  4. Add header: Authorization = Bearer {{admin_token}}"
echo ""
echo -e "${YELLOW}Quick test:${NC}"
echo "  curl ${API_URL}/health"
echo ""
echo -e "${YELLOW}Create a tournament (admin):${NC}"
echo "  curl -X POST ${API_URL}/tournaments \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'Authorization: Bearer <admin_token>' \\"
echo "    -d '{\"name\":\"Masters 2026\",\"espnEventId\":\"401811941\",\"startDate\":\"2026-04-09\",\"endDate\":\"2026-04-12\"}'"

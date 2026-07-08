#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"

echo "==> Health check"
curl -sf "$API_URL/health" | jq .

echo "==> Login as field engineer"
TOKEN=$(curl -sf -X POST "$API_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"engineer@demo.telecom"}' | jq -r .access_token)

echo "==> List projects"
curl -sf "$API_URL/api/v1/projects" -H "Authorization: Bearer $TOKEN" | jq .

ROUTE_ID="d0000000-0000-4000-8000-000000000001"

echo "==> Create segment"
SEGMENT=$(curl -sf -X POST "$API_URL/api/v1/routes/$ROUTE_ID/segments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"chainage_start":500,"chainage_end":1000,"surface_type":"urban"}')
echo "$SEGMENT" | jq .
SEGMENT_ID=$(echo "$SEGMENT" | jq -r .id)

echo "==> Save trench record"
curl -sf -X PUT "$API_URL/api/v1/segments/$SEGMENT_ID/trench" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"depth_m":1.65,"width_m":0.45,"bedding_type":"sand"}' | jq .

echo "==> NOC lookup"
curl -sf "$API_URL/api/v1/noc/lookup?segment_id=$SEGMENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo "==> Smoke test passed"

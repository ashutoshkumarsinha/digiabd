#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "==> Health check"
curl -sf "$API_URL/health" | "$JQ_BIN" .

echo "==> Login as field engineer"
TOKEN=$(login_token "${SMOKE_EMAIL:-engineer@demo.telecom}")

echo "==> List projects"
curl -sf "$API_URL/api/v1/projects" -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" .

ROUTE_ID="${ROUTE_ID:-d0000000-0000-4000-8000-000000000001}"

echo "==> Create segment"
SEGMENT=$(curl -sf -X POST "$API_URL/api/v1/routes/$ROUTE_ID/segments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"chainage_start":500,"chainage_end":1000,"surface_type":"urban"}')
echo "$SEGMENT" | "$JQ_BIN" .
SEGMENT_ID=$(echo "$SEGMENT" | "$JQ_BIN" -r .id)

echo "==> Save trench record"
curl -sf -X PUT "$API_URL/api/v1/segments/$SEGMENT_ID/trench" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"depth_m":1.65,"width_m":0.45,"bedding_type":"sand"}' | "$JQ_BIN" .

echo "==> NOC lookup"
curl -sf "$API_URL/api/v1/noc/lookup?segment_id=$SEGMENT_ID" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" .

echo "==> Smoke test passed"

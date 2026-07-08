#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "==> Health check (Phase 2)"
curl -sf "$API_URL/health" | "$JQ_BIN" .

echo "==> Login"
TOKEN=$(login_token "${SMOKE_EMAIL:-engineer@demo.telecom}")

ROUTE_ID="${ROUTE_ID:-d0000000-0000-4000-8000-000000000001}"

echo "==> Create segment"
SEGMENT=$(curl -sf -X POST "$API_URL/api/v1/routes/$ROUTE_ID/segments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: smoke-segment-$(date +%s)" \
  -d '{"chainage_start":1500,"chainage_end":2000,"surface_type":"urban"}')
SEGMENT_ID=$(echo "$SEGMENT" | "$JQ_BIN" -r .id)
echo "$SEGMENT" | "$JQ_BIN" .

echo "==> Save trench + duct + cable"
curl -sf -X PUT "$API_URL/api/v1/segments/$SEGMENT_ID/trench" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"depth_m":1.65,"width_m":0.45,"bedding_type":"sand"}' | "$JQ_BIN" .

curl -sf -X PUT "$API_URL/api/v1/segments/$SEGMENT_ID/duct" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"duct_type":"HDPE","duct_count":1,"diameter_mm":40}' | "$JQ_BIN" .

curl -sf -X POST "$API_URL/api/v1/segments/$SEGMENT_ID/cables" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"core_count":48,"laid_length_m":500,"drum_number":"DRUM-2026-001"}' | "$JQ_BIN" .

echo "==> Segment detail"
curl -sf "$API_URL/api/v1/segments/$SEGMENT_ID/detail" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '{completeness, status, trench, duct, cables: (.cables|length)}'

echo "==> Offline sync batch"
curl -sf -X POST "$API_URL/api/v1/sync/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: smoke-sync-$(date +%s)" \
  -d '{"device_id":"smoke-test","items":[{"client_id":"c1","operation":"upsert_trench","payload":{"segment_id":"'"$SEGMENT_ID"'","depth_m":1.7}}]}' | "$JQ_BIN" .

echo "==> SCM materials stub"
curl -sf "$API_URL/api/v1/integrations/scm/materials" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.materials | length'

echo "==> Notifications"
curl -sf "$API_URL/api/v1/notifications" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" 'length'

echo "==> Phase 2 smoke test passed"

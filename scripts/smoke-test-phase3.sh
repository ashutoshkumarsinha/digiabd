#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"

echo "==> Health check (Phase 3)"
curl -sf "$API_URL/health" | jq .

TOKEN=$(curl -sf -X POST "$API_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"engineer@demo.telecom"}' | jq -r .access_token)

ROUTE_ID="d0000000-0000-4000-8000-000000000001"

echo "==> Queue ETL job"
curl -sf -X POST "$API_URL/api/v1/etl/routes/$ROUTE_ID/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"job_type":"gis_layer_refresh"}' | jq .

echo "==> List ETL jobs"
curl -sf "$API_URL/api/v1/etl/jobs?route_id=$ROUTE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq 'length'

echo "==> GeoJSON export"
curl -sf "$API_URL/api/v1/gis/routes/$ROUTE_ID/geojson" \
  -H "Authorization: Bearer $TOKEN" | jq '.type'

echo "==> CAD generate"
curl -sf -X POST "$API_URL/api/v1/cad/routes/$ROUTE_ID/generate" \
  -H "Authorization: Bearer $TOKEN" | jq '.format'

echo "==> CAD artifacts"
curl -sf "$API_URL/api/v1/cad/routes/$ROUTE_ID/artifacts" \
  -H "Authorization: Bearer $TOKEN" | jq 'length'

echo "==> WMS capabilities"
curl -sf "$API_URL/api/v1/gis/wms/capabilities" \
  -H "Authorization: Bearer $TOKEN" | jq '.service'

echo "==> Phase 3 smoke test passed"

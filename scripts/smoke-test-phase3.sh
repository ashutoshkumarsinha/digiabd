#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "==> Health check (Phase 3)"
curl -sf "$API_URL/health" | "$JQ_BIN" .

TOKEN=$(login_token "${SMOKE_EMAIL:-engineer@demo.telecom}")

ROUTE_ID="${ROUTE_ID:-d0000000-0000-4000-8000-000000000001}"

echo "==> Queue ETL job"
curl -sf -X POST "$API_URL/api/v1/etl/routes/$ROUTE_ID/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"job_type":"gis_layer_refresh"}' | "$JQ_BIN" .

echo "==> List ETL jobs"
curl -sf "$API_URL/api/v1/etl/jobs?route_id=$ROUTE_ID" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" 'length'

echo "==> GeoJSON export"
curl -sf "$API_URL/api/v1/gis/routes/$ROUTE_ID/geojson" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.type'

echo "==> Planned vs actual overlay"
curl -sf "$API_URL/api/v1/gis/routes/$ROUTE_ID/overlay" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.type, (.features | length)'

echo "==> GIS export formats (GeoJSON/KML/Shapefile bundle)"
curl -sf "$API_URL/api/v1/gis/routes/$ROUTE_ID/export?format=geojson" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.format, .file_ref'
curl -sf "$API_URL/api/v1/gis/routes/$ROUTE_ID/export?format=kml" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.format, .file_ref'
curl -sf "$API_URL/api/v1/gis/routes/$ROUTE_ID/export?format=shapefile" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.format, .file_ref'

echo "==> CAD generate"
curl -sf -X POST "$API_URL/api/v1/cad/routes/$ROUTE_ID/generate" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.format'

echo "==> CAD artifacts"
curl -sf "$API_URL/api/v1/cad/routes/$ROUTE_ID/artifacts" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" 'length'

echo "==> WMS capabilities"
curl -sf "$API_URL/api/v1/gis/wms/capabilities" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.service'

echo "==> Phase 3 smoke test passed"

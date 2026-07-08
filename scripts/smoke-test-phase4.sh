#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"

echo "==> Health check (Phase 4)"
curl -sf "$API_URL/health" | jq .

TOKEN=$(curl -sf -X POST "$API_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.telecom"}' | jq -r .access_token)

PROJECT_ID="c0000000-0000-4000-8000-000000000001"
ROUTE_ID="d0000000-0000-4000-8000-000000000001"

echo "==> Governance dashboard"
curl -sf "$API_URL/api/v1/governance/dashboard" \
  -H "Authorization: Bearer $TOKEN" | jq '.projects, .segments'

echo "==> Project SLA"
curl -sf "$API_URL/api/v1/governance/projects/$PROJECT_ID/sla" \
  -H "Authorization: Bearer $TOKEN" | jq '.sla_status, .abd_completeness_rate'

echo "==> Create test segment for compliance"
SEGMENT=$(curl -sf -X POST "$API_URL/api/v1/routes/$ROUTE_ID/segments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"chainage_start":6000,"chainage_end":6500,"surface_type":"urban"}')
SEGMENT_ID=$(echo "$SEGMENT" | jq -r .id)

curl -sf -X PUT "$API_URL/api/v1/segments/$SEGMENT_ID/trench" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"depth_m":1.65}' > /dev/null

echo "==> Segment compliance report"
curl -sf "$API_URL/api/v1/governance/segments/$SEGMENT_ID/compliance" \
  -H "Authorization: Bearer $TOKEN" | jq '.compliance_status, (.checks | length)'

echo "==> Evaluate escalations"
curl -sf -X POST "$API_URL/api/v1/governance/escalations/evaluate" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"project_id\":\"$PROJECT_ID\"}" | jq '.triggered_count'

echo "==> List escalations"
curl -sf "$API_URL/api/v1/governance/escalations" \
  -H "Authorization: Bearer $TOKEN" | jq 'length'

echo "==> RCA hints"
curl -sf "$API_URL/api/v1/governance/noc/rca-hints?chainage=2500" \
  -H "Authorization: Bearer $TOKEN" | jq '.hints'

echo "==> Executive summary"
curl -sf "$API_URL/api/v1/governance/executive/summary" \
  -H "Authorization: Bearer $TOKEN" | jq '.portfolio.projects, (.projects | length)'

echo "==> Audit export"
curl -sf -X POST "$API_URL/api/v1/governance/audit/export" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"route_id\":\"$ROUTE_ID\"}" | jq '.export.record_count'

echo "==> Phase 4 smoke test passed"

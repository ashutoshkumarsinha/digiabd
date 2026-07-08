#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "==> Health check (Phase 4)"
curl -sf "$API_URL/health" | "$JQ_BIN" .

TOKEN=$(login_token "${SMOKE_EMAIL:-admin@demo.telecom}")

PROJECT_ID="${PROJECT_ID:-c0000000-0000-4000-8000-000000000001}"
ROUTE_ID="${ROUTE_ID:-d0000000-0000-4000-8000-000000000001}"

echo "==> Governance dashboard"
curl -sf "$API_URL/api/v1/governance/dashboard" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.projects, .segments'

echo "==> Approval workflow config"
curl -sf "$API_URL/api/v1/projects/$PROJECT_ID/workflow/approval-chain" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.approval_chain'

echo "==> Project SLA"
curl -sf "$API_URL/api/v1/governance/projects/$PROJECT_ID/sla" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.sla_status, .abd_completeness_rate'

echo "==> Create test segment for compliance"
SEGMENT=$(curl -sf -X POST "$API_URL/api/v1/routes/$ROUTE_ID/segments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"chainage_start":6000,"chainage_end":6500,"surface_type":"urban"}')
SEGMENT_ID=$(echo "$SEGMENT" | "$JQ_BIN" -r .id)

curl -sf -X PUT "$API_URL/api/v1/segments/$SEGMENT_ID/trench" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"depth_m":1.65}' > /dev/null

echo "==> Segment compliance report"
curl -sf "$API_URL/api/v1/governance/segments/$SEGMENT_ID/compliance" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.compliance_status, (.checks | length)'

echo "==> Evaluate escalations"
curl -sf -X POST "$API_URL/api/v1/governance/escalations/evaluate" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"project_id\":\"$PROJECT_ID\"}" | "$JQ_BIN" '.triggered_count'

echo "==> List escalations"
EVENT_ID=$(curl -sf "$API_URL/api/v1/governance/escalations?status=open" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" -r '.[0].id // empty')

if [[ -n "$EVENT_ID" ]]; then
  echo "==> Acknowledge escalation $EVENT_ID"
  curl -sf -X POST "$API_URL/api/v1/governance/escalations/$EVENT_ID/acknowledge" \
    -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.status'

  echo "==> Resolve escalation $EVENT_ID"
  curl -sf -X POST "$API_URL/api/v1/governance/escalations/$EVENT_ID/resolve" \
    -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.status, .resolved_at'
else
  echo "==> No open escalations to acknowledge/resolve (skipped)"
fi

echo "==> RCA hints"
curl -sf "$API_URL/api/v1/governance/noc/rca-hints?chainage=2500" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.hints'

echo "==> Executive summary"
curl -sf "$API_URL/api/v1/governance/executive/summary" \
  -H "Authorization: Bearer $TOKEN" | "$JQ_BIN" '.portfolio.projects, (.projects | length)'

echo "==> Audit export"
curl -sf -X POST "$API_URL/api/v1/governance/audit/export" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"route_id\":\"$ROUTE_ID\"}" | "$JQ_BIN" '.export.record_count, .export.file_ref, .artifact.content_type'

echo "==> Phase 4 smoke test passed"

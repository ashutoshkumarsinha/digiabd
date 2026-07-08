# Functional Requirements Traceability Matrix

**Spec:** [spec.md](../spec.md) §7 · **API:** v0.4.0 · **OpenAPI:** [openapi.yaml](./openapi.yaml)  
**Last updated:** 2026-07-08

## Legend

| Status | Meaning |
|---|---|
| **Implemented** | End-to-end capability present (API + persistence; mobile/web where applicable) |
| **Partial** | Core path exists; spec gaps noted in Notes |
| **Deferred** | Not built; planned post-launch or external dependency |

## Summary

| Priority | Total | Implemented | Partial | Deferred |
|---|---|---|---|---|
| P0 | 36 | 16 | 14 | 6 |
| P1 | 16 | 2 | 8 | 6 |
| P2 | 2 | 0 | 0 | 2 |
| **All FRs** | **54** | **18** | **22** | **14** |

P0 partial/deferred items are the primary go-live gaps.

---

## Field Capture (FR-001 – FR-012)

| ID | Requirement (abbrev.) | API / Component | Status | Test |
|---|---|---|---|---|
| FR-001 | Create route segments linked to project/route | `POST /api/v1/routes/:routeId/segments` | Implemented | `scripts/smoke-test.sh` |
| FR-002 | Mobile GPS capture with accuracy thresholds | `POST /api/v1/segments/:segmentId/survey-points`; `apps/mobile/` (expo-location) | Partial | `scripts/smoke-test-phase2.sh` (API); mobile manual |
| FR-003 | Offline capture + auto sync | `POST /api/v1/sync/batch`; `apps/mobile/` offline queue | Implemented | `scripts/smoke-test-phase2.sh` |
| FR-004 | Trenching attributes | `PUT /api/v1/segments/:segmentId/trench` | Implemented | `scripts/smoke-test.sh` |
| FR-005 | Ducting attributes | `PUT /api/v1/segments/:segmentId/duct` | Implemented | `scripts/smoke-test-phase2.sh` |
| FR-006 | HDD crossing details | — | Deferred | — |
| FR-007 | Geo-tagged photos with metadata | `POST /api/v1/segments/:segmentId/photos` (MinIO) | Implemented | manual / web upload |
| FR-008 | Cable specifications | `POST /api/v1/segments/:segmentId/cables` | Implemented | `scripts/smoke-test-phase2.sh` |
| FR-009 | Joint/closure locations | `POST /api/v1/segments/:segmentId/closures` | Implemented | `scripts/smoke-test-phase2.sh` |
| FR-010 | OTDR test uploads (PDF/CSV) | Schema only (`otdr_results` table); no upload route | Deferred | — |
| FR-011 | Incomplete ABD package flag before submit | `POST /api/v1/segments/:segmentId/submit` → 422 | Implemented | `scripts/smoke-test-phase2.sh` |
| FR-012 | Barcode/QR scanning for asset tags | — | Deferred | — |

---

## Deviations & Approvals (FR-020 – FR-025)

| ID | Requirement (abbrev.) | API / Component | Status | Test |
|---|---|---|---|---|
| FR-020 | Record deviations with evidence | `POST /api/v1/deviations` | Implemented | `scripts/smoke-test.sh` |
| FR-021 | Configurable approval workflow | `POST /api/v1/deviations/:id/approve` (fixed Supervisor→OIC path) | Partial | manual |
| FR-022 | Full approval audit trail | `approval_actions` table; governance audit export | Partial | `scripts/smoke-test-phase4.sh` (export) |
| FR-023 | Planned vs actual GIS overlay | — | Deferred | — |
| FR-024 | Block sign-off with open deviations | `POST /api/v1/segments/:segmentId/sign-off` → 422 | Implemented | manual |
| FR-025 | Digital signature / OTP sign-off | — | Deferred | — |

---

## Repository & Search (FR-030 – FR-034)

| ID | Requirement (abbrev.) | API / Component | Status | Test |
|---|---|---|---|---|
| FR-030 | Centralized cloud repository | PostgreSQL + PostGIS + MinIO (`docker-compose`) | Implemented | infra / `npm run db:up` |
| FR-031 | Advanced search (bbox, asset IDs, etc.) | `GET /api/v1/noc/lookup`, `GET /api/v1/segments/:id`, segment detail | Partial | `scripts/smoke-test.sh` (NOC) |
| FR-032 | Record versioning | — | Deferred | — |
| FR-033 | Audit package export (ZIP/PDF + GIS) | `POST /api/v1/governance/audit/export` (JSON) | Partial | `scripts/smoke-test-phase4.sh` |
| FR-034 | Bulk legacy import | — | Deferred | — |

---

## GIS & CAD (FR-040 – FR-044)

| ID | Requirement (abbrev.) | API / Component | Status | Test |
|---|---|---|---|---|
| FR-040 | GIS layers (centerline, closures, crossings) | `GET /api/v1/gis/routes/:routeId/geojson` | Partial | `scripts/smoke-test-phase3.sh` |
| FR-041 | Export GeoJSON, Shapefile, KML, WMS/WFS | GeoJSON + `GET /api/v1/gis/wms/capabilities` | Partial | `scripts/smoke-test-phase3.sh` |
| FR-042 | As-built AutoCAD via ETL | `POST /api/v1/cad/routes/:routeId/generate` (JSON placeholder) | Partial | `scripts/smoke-test-phase3.sh` |
| FR-043 | GIS feature metadata tags | GeoJSON `properties` on features | Partial | `scripts/smoke-test-phase3.sh` |
| FR-044 | GPS vs alignment reconciliation | — | Deferred | — |

---

## Governance & SLA (FR-050 – FR-055)

| ID | Requirement (abbrev.) | API / Component | Status | Test |
|---|---|---|---|---|
| FR-050 | ABD completeness dashboards | `GET /api/v1/governance/dashboard`; `apps/web/` governance view | Implemented | `scripts/smoke-test-phase4.sh` |
| FR-051 | NOC route/asset lookup | `GET /api/v1/noc/lookup` | Implemented | `scripts/smoke-test.sh` |
| FR-052 | MTBF/MTTR SLA metrics | `GET /api/v1/governance/projects/:projectId/sla` | Implemented | `scripts/smoke-test-phase4.sh` |
| FR-053 | Configurable escalation matrices | `POST/GET /api/v1/governance/escalations/*` | Implemented | `scripts/smoke-test-phase4.sh` |
| FR-054 | RCA hints (fault ↔ deviation) | `GET /api/v1/governance/noc/rca-hints` | Implemented | `scripts/smoke-test-phase4.sh` |
| FR-055 | Completeness threshold alerts | `POST /api/v1/governance/escalations/evaluate` (`completeness_below`) | Partial | `scripts/smoke-test-phase4.sh` |

---

## Administration (FR-060 – FR-063)

| ID | Requirement (abbrev.) | API / Component | Status | Test |
|---|---|---|---|---|
| FR-060 | RBAC with project/vendor scope | JWT roles + `requireRoles` middleware | Implemented | manual role matrix |
| FR-061 | Configurable mandatory checklists | — | Deferred | — |
| FR-062 | Multi-tenant project isolation | RLS policies (`database/migrations`); org context | Implemented | manual |
| FR-063 | Training sandbox environments | — | Deferred | — |

---

## Enterprise Platform (FR-070 – FR-080)

| ID | Requirement (abbrev.) | API / Component | Status | Test |
|---|---|---|---|---|
| FR-070 | Hierarchy: Org → BU → Project → Route | `organizations`, `projects`, `routes`, `segments` | Partial | `scripts/smoke-test.sh` (no BU entity) |
| FR-071 | Tenant isolation (DB + API) | PostgreSQL RLS + org-scoped queries | Implemented | manual |
| FR-072 | Domain events on message bus | Kafka/Redpanda (`services/events.ts`) | Partial | manual (bus optional) |
| FR-073 | API gateway (OAuth, rate limit, keys) | JWT auth; OIDC callback 501; no gateway | Partial | `scripts/smoke-test.sh` |
| FR-074 | Retention / legal hold policies | — | Deferred | — |
| FR-075 | Data catalog with lineage | — | Deferred | — |
| FR-076 | Delegated tenant administration | Role model supports org admin; no admin UI | Partial | manual |
| FR-077 | Executive portfolio dashboards | `GET /api/v1/governance/executive/summary` | Implemented | `scripts/smoke-test-phase4.sh` |
| FR-078 | Bulk operations API (≥10k records) | `POST /api/v1/sync/batch` (limited ops) | Partial | `scripts/smoke-test-phase2.sh` |
| FR-079 | Idempotent write APIs | `Idempotency-Key` middleware (`app.ts`) | Implemented | manual |
| FR-080 | Per-tenant feature flags | — | Deferred | — |

---

## Notifications & Collaboration (FR-090 – FR-094)

| ID | Requirement (abbrev.) | API / Component | Status | Test |
|---|---|---|---|---|
| FR-090 | Email, SMS, in-app notifications | `GET /api/v1/notifications` (in-app only) | Partial | `scripts/smoke-test-phase2.sh` |
| FR-091 | Teams / Slack integration | — | Deferred | — |
| FR-092 | Project activity feed | — | Deferred | — |
| FR-093 | @mentions and task assignments | — | Deferred | — |
| FR-094 | Notification preferences per user | — | Deferred | — |

---

## P0 Gap Register (Go-Live Blockers)

| FR | Gap | Recommended action |
|---|---|---|
| FR-006 | No HDD crossing API | Add `PUT /segments/:id/hdd-crossing` + mobile form |
| FR-010 | No OTDR upload endpoint | Add multipart upload + link to closures/spans |
| FR-021 | Fixed approval chain | Make workflow steps configurable per project |
| FR-023 | No planned-route overlay | Import design alignment + map layer API |
| FR-032 | No versioning | Add `record_versions` table + read APIs |
| FR-033 | JSON-only audit export | Generate ZIP (report PDF + GeoJSON layer) |
| FR-041 | Shapefile/KML missing | Add export jobs via ETL pipeline |
| FR-042 | CAD placeholder only | Integrate DXF/DWG generation worker |
| FR-061 | No checklist config | Admin API for mandatory fields per `project_type` |
| FR-073 | No production API gateway | Deploy Kong/AWS API Gateway in front of service |
| FR-074 | No retention policies | Add tenant policy tables + purge jobs |
| FR-090 | No email/SMS | Wire escalation events to notification provider |

---

## API Endpoint Index (v0.4.0)

All endpoints below are documented in [openapi.yaml](./openapi.yaml).

| Method | Path | Primary FRs |
|---|---|---|
| GET | `/health` | NFR-011 |
| POST | `/api/v1/auth/login` | FR-060, FR-073 |
| GET | `/api/v1/auth/oidc/config` | FR-073 |
| POST | `/api/v1/auth/oidc/callback` | FR-073 (stub) |
| GET | `/api/v1/auth/me` | FR-060 |
| GET | `/api/v1/organizations` | FR-070, FR-071 |
| GET/POST | `/api/v1/projects` | FR-070 |
| GET/POST | `/api/v1/projects/:projectId/routes` | FR-070 |
| GET/POST | `/api/v1/routes/:routeId/segments` | FR-001 |
| GET | `/api/v1/segments/:segmentId` | FR-031 |
| GET | `/api/v1/segments/:segmentId/detail` | FR-031 |
| PUT | `/api/v1/segments/:segmentId/trench` | FR-004 |
| PUT | `/api/v1/segments/:segmentId/duct` | FR-005 |
| POST | `/api/v1/segments/:segmentId/cables` | FR-008 |
| POST | `/api/v1/segments/:segmentId/survey-points` | FR-002 |
| POST | `/api/v1/segments/:segmentId/closures` | FR-009 |
| POST | `/api/v1/segments/:segmentId/photos` | FR-007 |
| POST | `/api/v1/segments/:segmentId/submit` | FR-011 |
| POST | `/api/v1/segments/:segmentId/sign-off` | FR-024 |
| POST | `/api/v1/deviations` | FR-020 |
| POST | `/api/v1/deviations/:deviationId/approve` | FR-021, FR-022 |
| GET | `/api/v1/noc/lookup` | FR-051 |
| POST | `/api/v1/sync/batch` | FR-003, FR-078, FR-079 |
| GET/POST | `/api/v1/webhooks` | NFR-011 |
| GET | `/api/v1/integrations/scm/materials` | FR-030 |
| POST | `/api/v1/integrations/scm/receipts` | FR-030 |
| GET/POST | `/api/v1/assets` | FR-031 |
| GET | `/api/v1/notifications` | FR-090 |
| GET | `/api/v1/gis/wms/capabilities` | FR-041 |
| GET | `/api/v1/gis/routes/:routeId/geojson` | FR-040, FR-041, FR-043 |
| POST | `/api/v1/cad/routes/:routeId/generate` | FR-042 |
| GET | `/api/v1/cad/routes/:routeId/artifacts` | FR-042 |
| POST | `/api/v1/etl/routes/:routeId/jobs` | FR-042 |
| GET | `/api/v1/etl/jobs` | FR-042 |
| GET | `/api/v1/governance/dashboard` | FR-050 |
| GET | `/api/v1/governance/projects/:projectId/sla` | FR-052 |
| GET | `/api/v1/governance/segments/:segmentId/compliance` | FR-050, FR-055 |
| GET/POST | `/api/v1/governance/escalations/rules` | FR-053 |
| POST | `/api/v1/governance/escalations/evaluate` | FR-053, FR-055 |
| GET | `/api/v1/governance/escalations` | FR-053 |
| GET | `/api/v1/governance/executive/summary` | FR-077 |
| GET | `/api/v1/governance/noc/rca-hints` | FR-054 |
| POST | `/api/v1/governance/audit/export` | FR-022, FR-033 |

---

## Verification Commands

```bash
npm run db:up && npm run dev   # terminal 1
bash scripts/smoke-test.sh
bash scripts/smoke-test-phase2.sh
bash scripts/smoke-test-phase3.sh
bash scripts/smoke-test-phase4.sh
```

# Test Case Matrix (FR → Endpoint → Test ID)

**Scope:** API + Web + Mobile + Infra + Observability  \n
**Spec:** [spec.md](../spec.md) §7  \n
**OpenAPI:** [docs/openapi.yaml](./openapi.yaml)  \n
**Last updated:** 2026-07-08

## Conventions

- **Test IDs**: `TC-<AREA>-<NNN>`
- **Automation target**:
  - `API-UNIT`: Vitest unit tests (`apps/api/src/**/*.test.ts`)
  - `API-INT`: Fastify `app.inject()` integration tests (`apps/api/src/__tests__/*`)
  - `SMOKE`: shell smoke tests (`scripts/smoke-test*.sh`)
  - `WEB-E2E`: web portal E2E (recommended Playwright)
  - `MOBILE-E2E`: mobile E2E (recommended Detox/Maestro)
  - `MANUAL`: manual verification

## Where tests live (initial scaffolding)

- API test scaffolding: `apps/api/src/__tests__/` (skeletons + harness)
- Existing unit tests: `apps/api/src/services/governance.test.ts`, `apps/api/src/services/storage.test.ts`

## High-level suites (planned)

| Suite | File / Location | Primary FRs |
|---|---|---|
| Auth routes | `apps/api/src/__tests__/auth.routes.test.ts` | FR-060, FR-073 |
| RBAC middleware | `apps/api/src/__tests__/rbac.test.ts` | FR-060 |
| Projects/routes | `apps/api/src/__tests__/projects.routes.test.ts` | FR-070, FR-071 |
| Field capture | `apps/api/src/__tests__/field-capture.routes.test.ts` | FR-001–012 |
| Governance | `apps/api/src/__tests__/governance.routes.test.ts` | FR-050–055, FR-077 |
| OIDC/Keycloak | `apps/api/src/__tests__/oidc.keycloak.test.ts` | FR-060, FR-071, FR-073 |
| Observability | `apps/api/src/__tests__/observability.test.ts` | NFR-019 |

---

## Functional Requirements Traceability

### Field Capture (FR-001 – FR-012)

| FR | Test IDs | Endpoint(s) / Component | Automation |
|---|---|---|---|
| FR-001 | TC-FC-001 | `POST /api/v1/routes/:routeId/segments` | API-INT, SMOKE (`scripts/smoke-test*.sh`) |
| FR-002 | TC-FC-002 | `POST /api/v1/segments/:segmentId/survey-points`; `apps/mobile/` GPS capture | API-INT, MOBILE-E2E |
| FR-003 | TC-SYNC-001 | `POST /api/v1/sync/batch`; mobile offline queue | API-INT, SMOKE (`scripts/smoke-test-phase2.sh`), MOBILE-E2E |
| FR-004 | TC-FC-003 | `PUT /api/v1/segments/:segmentId/trench` | API-INT, SMOKE |
| FR-005 | TC-FC-004 | `PUT /api/v1/segments/:segmentId/duct` | API-INT, SMOKE |
| FR-006 | TC-FC-005 | HDD crossings (deferred) | MANUAL (gap) |
| FR-007 | TC-PHOTO-001 | `POST /api/v1/segments/:segmentId/photos` | API-INT, WEB-E2E, MANUAL |
| FR-008 | TC-FC-006 | `POST /api/v1/segments/:segmentId/cables` | API-INT, SMOKE |
| FR-009 | TC-FC-007 | `POST /api/v1/segments/:segmentId/closures` | API-INT, SMOKE |
| FR-010 | TC-OTDR-001 | OTDR upload (deferred) | MANUAL (gap) |
| FR-011 | TC-FC-008 | `POST /api/v1/segments/:segmentId/submit` | API-INT, SMOKE |
| FR-012 | TC-FC-009 | QR/barcode (deferred) | MOBILE-E2E (future) |

### Deviations & Approvals (FR-020 – FR-025)

| FR | Test IDs | Endpoint(s) / Component | Automation |
|---|---|---|---|
| FR-020 | TC-DEV-001 | `POST /api/v1/deviations` | API-INT |
| FR-021 | TC-DEV-002 | `POST /api/v1/deviations/:deviationId/approve` | API-INT |
| FR-022 | TC-DEV-003 | Approval audit trail + audit export | API-INT, SMOKE (`scripts/smoke-test-phase4.sh`) |
| FR-023 | TC-GIS-002 | Planned vs actual overlay (deferred) | WEB-E2E (future) |
| FR-024 | TC-DEV-004 | `POST /api/v1/segments/:segmentId/sign-off` blocks open deviations | API-INT |
| FR-025 | TC-DEV-005 | OTP / signature sign-off (deferred) | WEB-E2E (future) |

### Repository & Search (FR-030 – FR-034)

| FR | Test IDs | Endpoint(s) / Component | Automation |
|---|---|---|---|
| FR-030 | TC-REPO-001 | Postgres + MinIO + artifact persistence | API-INT, MANUAL |
| FR-031 | TC-SRCH-001 | `GET /api/v1/noc/lookup` and segment detail | API-INT, SMOKE |
| FR-032 | TC-REPO-002 | Versioning (deferred) | MANUAL (gap) |
| FR-033 | TC-AUDIT-001 | `POST /api/v1/governance/audit/export` | API-INT, SMOKE |
| FR-034 | TC-REPO-003 | Legacy import (deferred) | MANUAL (gap) |

### GIS & CAD (FR-040 – FR-044)

| FR | Test IDs | Endpoint(s) / Component | Automation |
|---|---|---|---|
| FR-040 | TC-GIS-001 | `GET /api/v1/gis/routes/:routeId/geojson` | API-INT, SMOKE (`scripts/smoke-test-phase3.sh`) |
| FR-041 | TC-GIS-003 | GeoJSON + WMS capabilities | API-INT, SMOKE |
| FR-042 | TC-CAD-001 | `POST /api/v1/cad/routes/:routeId/generate`, `GET /artifacts` | API-INT, SMOKE |
| FR-043 | TC-GIS-004 | GeoJSON feature metadata tags | API-INT |
| FR-044 | TC-GIS-005 | GPS reconciliation (deferred) | WEB-E2E (future) |

### Governance & SLA (FR-050 – FR-055)

| FR | Test IDs | Endpoint(s) / Component | Automation |
|---|---|---|---|
| FR-050 | TC-GOV-001 | `GET /api/v1/governance/dashboard` | API-INT, SMOKE (`scripts/smoke-test-phase4.sh`) |
| FR-051 | TC-NOC-001 | `GET /api/v1/noc/lookup` | API-INT, SMOKE |
| FR-052 | TC-GOV-002 | `GET /api/v1/governance/projects/:projectId/sla` | API-INT, SMOKE |
| FR-053 | TC-GOV-003 | escalation rules + evaluate + list | API-INT, SMOKE |
| FR-054 | TC-GOV-004 | `GET /api/v1/governance/noc/rca-hints` | API-INT, SMOKE |
| FR-055 | TC-GOV-005 | completeness threshold / alerts (partial) | API-INT, SMOKE |

### Administration (FR-060 – FR-063)

| FR | Test IDs | Endpoint(s) / Component | Automation |
|---|---|---|---|
| FR-060 | TC-AUTHZ-001 | `authenticate`, `requireRoles`, endpoint RBAC | API-UNIT, API-INT |
| FR-061 | TC-ADMIN-001 | checklists (deferred) | MANUAL (gap) |
| FR-062 | TC-TEN-001 | RLS/multi-tenant isolation | API-INT, MANUAL |
| FR-063 | TC-ADMIN-002 | sandbox env (deferred) | MANUAL (gap) |

### Enterprise Platform (FR-070 – FR-080)

| FR | Test IDs | Endpoint(s) / Component | Automation |
|---|---|---|---|
| FR-070 | TC-ENT-001 | org/project/route hierarchy | API-INT |
| FR-071 | TC-ENT-002 | tenant isolation DB + API | API-INT, MANUAL |
| FR-072 | TC-ENT-003 | Kafka events publish (optional bus) | MANUAL |
| FR-073 | TC-OIDC-001 | Keycloak JWT acceptance + OIDC config | API-INT, MANUAL |
| FR-074 | TC-ENT-004 | retention/legal hold (deferred) | MANUAL (gap) |
| FR-075 | TC-ENT-005 | data catalog (deferred) | MANUAL (gap) |
| FR-076 | TC-ENT-006 | delegated admin (partial) | MANUAL |
| FR-077 | TC-GOV-006 | exec summary | API-INT, SMOKE |
| FR-078 | TC-SYNC-002 | bulk ops via sync batch (partial) | API-INT |
| FR-079 | TC-IDEMP-001 | Idempotency-Key behavior | API-INT |
| FR-080 | TC-ENT-007 | feature flags (deferred) | MANUAL (gap) |

### Notifications & Collaboration (FR-090 – FR-094)

| FR | Test IDs | Endpoint(s) / Component | Automation |
|---|---|---|---|
| FR-090 | TC-NOTIF-001 | `GET /api/v1/notifications` (in-app only) | API-INT, SMOKE |
| FR-091 | TC-NOTIF-002 | Teams/Slack (deferred) | MANUAL (gap) |
| FR-092 | TC-NOTIF-003 | activity feed (deferred) | MANUAL (gap) |
| FR-093 | TC-NOTIF-004 | mentions/assignments (deferred) | MANUAL (gap) |
| FR-094 | TC-NOTIF-005 | preferences (deferred) | MANUAL (gap) |

---

## Smoke regression coverage

| Script | Coverage highlights |
|---|---|
| `scripts/smoke-test.sh` | login, projects, create segment, trench, noc lookup |
| `scripts/smoke-test-phase2.sh` | field capture core + sync + integrations + notifications |
| `scripts/smoke-test-phase3.sh` | ETL + GIS + CAD |
| `scripts/smoke-test-phase4.sh` | governance dashboard + SLA + compliance + escalations + executive summary + audit export |

---

## Recommended next automation steps

1. Implement `API-INT` suites by mocking DB at first, then switching to dockerized Postgres in CI.
2. Add Playwright for `WEB-E2E` covering OIDC login + governance dashboard.
3. Add Maestro/Detox for `MOBILE-E2E` covering offline capture + sync.


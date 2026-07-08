# Digital ABD — Phase 1 MVP Scope

This document defines what ships in **Phase 1 (Months 1–3)** vs. what is deferred.

## Phase 1 — In Scope (Building Now)

| Area | Capability | FR Ref |
|---|---|---|
| **Platform** | Monorepo, Docker Compose, CI/CD | — |
| **Database** | PostgreSQL + PostGIS schema with RLS | FR-070, FR-071 |
| **Auth** | Dev JWT login (OIDC in Phase 2) | FR-060 |
| **Projects** | CRUD projects, routes, segments | FR-001 |
| **Field Capture** | Trench records, photo upload to MinIO | FR-004, FR-007 |
| **Workflow** | Deviation create + OIC approval | FR-020–FR-022 |
| **NOC** | Basic asset lookup API | FR-051 |
| **Audit** | Audit log on key actions | NFR-008 |
| **API** | REST `/api/v1`, OpenAPI docs at `/docs` | NFR-011 |
| **Completeness** | Auto-calculated segment completeness score | FR-011 |

## Phase 1 — Deferred

| Area | Defer To | Reason |
|---|---|---|
| Kafka event bus | Phase 2 | Webhooks sufficient for MVP |
| SCIM / SSO (OIDC) | Phase 2 | Dev JWT for pilot |
| Multi-region DR | Phase 3 | Single-region HA first |
| Mobile app (React Native) | Phase 2 | API-first; mobile consumes API |
| GIS ETL / AutoCAD export | Phase 3 | Needs GIS engineer |
| SLA dashboards | Phase 4 | Requires data accumulation |
| SOC 2 / ISO 27001 | Phase 4 | Certification readiness |

## Phase 1 Exit Criteria

- [ ] `docker compose up` starts full local stack
- [ ] End-to-end API flow: login → create segment → trench → photo → deviation → approve
- [ ] NOC lookup returns segment + deviations
- [ ] Tenant isolation verified (RLS + API org context)
- [ ] CI pipeline green on every PR

## Current Implementation Status

| Component | Status |
|---|---|
| Docker Compose (Postgres, Redis, MinIO) | ✅ Done |
| Database schema + seed data | ✅ Done |
| API — auth, projects, routes, segments | ✅ Done |
| API — trench, photos, deviations, NOC | ✅ Done |
| Web portal shell | 🔄 In progress |
| Mobile app | ⏳ Phase 2 |
| OpenAPI spec file | ✅ Done |
| CI pipeline | ✅ Done |

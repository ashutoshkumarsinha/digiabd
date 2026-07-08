# High-Level Design (HLD) — Digital ABD

## 1. Purpose

This HLD describes the end-to-end solution architecture for Digital ABD, including system boundaries, component responsibilities, integrations, deployment topology, operational controls, and key design decisions.

It is implementation-aligned with the current repository state (`v0.4.0`) and highlights target-state extensions where capabilities are partial/deferred.

## 2. Scope

In scope:

- API platform (Fastify/TypeScript)
- Web portal (React)
- Mobile field app (Expo)
- Data platform (PostgreSQL/PostGIS, object storage, Redis)
- Integration/eventing (Kafka-compatible bus)
- Identity (internal JWT + OIDC federation via Keycloak/IdP)
- Observability (OpenTelemetry + SigNoz)
- Deployment models (Docker Compose, Helm/Kubernetes)

Out of scope:

- Detailed low-level DB schema walkthrough (see `database/migrations`)
- Per-function code-level behavior (see `docs/CODE_FLOW.md`)

## 3. Context and Business Drivers

Digital ABD provides a single digital system of record for optical fiber as-built documentation:

- Improve MTTR and fault localization via route/asset intelligence
- Improve compliance and audit readiness for TEC/DoT-aligned workflows
- Reduce data fragmentation across field, GIS, CAD, and governance teams
- Enable multi-tenant enterprise operation with role-based controls

## 4. Logical Architecture

### 4.1 Component View

1. **Clients**
   - Web portal (`apps/web`)
   - Mobile app (`apps/mobile`)
   - External enterprise integrations (REST/webhooks)
2. **API Layer**
   - Auth endpoints (dev JWT + OIDC config)
   - Field capture endpoints
   - Workflow/deviation endpoints
   - Resilience/GIS/CAD/ETL endpoints
   - Governance/SLA/escalation endpoints
3. **Data and State Layer**
   - PostgreSQL + PostGIS (system of record)
   - Object storage (photos/artifacts)
   - Redis (idempotency/cache primitives)
4. **Event/Integration Layer**
   - Kafka/Redpanda publisher for domain events
   - Webhook dispatch support
5. **Identity and Access**
   - Internal JWT for dev/hybrid flows
   - OIDC JWT validation using IdP JWKS
6. **Operations Layer**
   - OTel traces/metrics/logs
   - SigNoz dashboards
   - Smoke tests + integration test suites

### 4.2 Primary Runtime Flows

#### A) Field capture flow

1. User authenticates (JWT/OIDC)
2. Segment created
3. Field records (trench/duct/cable/survey/closure/photo) captured
4. Submit endpoint checks completeness
5. OIC sign-off blocks on unresolved deviations

#### B) Governance flow

1. SLA dashboard computes project/org metrics
2. Escalation rules evaluated
3. RCA hints correlate faults and construction patterns
4. Audit package exported for route/project

#### C) Offline mobile sync flow

1. Mobile app enqueues offline operations locally
2. Queue submitted via `/api/v1/sync/batch`
3. Server applies items with idempotency protections

## 5. Application Design

## 5.1 API module decomposition

- `routes/auth.ts`: login, OIDC config, user profile
- `routes/projects.ts`: projects and routes
- `routes/segments.ts`: segment CRUD + trench
- `routes/field-capture.ts`: duct/cable/survey/closure/submit/sign-off/assets/notifications
- `routes/workflows.ts`: deviations, photos, NOC lookup
- `routes/integrations.ts`: sync, webhooks, SCM stubs
- `routes/resilience.ts`: GIS/CAD/ETL
- `routes/governance.ts`: dashboards, SLA, escalations, executive summary, audit export

## 5.2 Core platform middleware

- Authentication middleware:
  - attempts OIDC JWT verification when enabled
  - falls back to internal JWT verification in hybrid mode
- RBAC middleware:
  - route-level role checks with enterprise/system admin override
- Idempotency middleware:
  - protects write endpoints from duplicate processing
- Error handler:
  - standard RFC 7807 response shape

## 5.3 Tenant isolation pattern

- Auth token carries `orgId`
- All domain access goes through `withOrgContext(...)`
- DB session sets tenant context (`app.current_org_id`)
- Queries are scoped by `org_id`

## 6. Data Architecture

## 6.1 Datastores

- **PostgreSQL + PostGIS**
  - core transactional and spatial dataset
  - migrations `001`–`004` cover foundational, phase2, phase3, phase4 domains
- **Object storage (MinIO/S3-compatible)**
  - photo evidence and file artifacts
- **Redis**
  - request/idempotency support path and cache-friendly use cases

## 6.2 Data domains

- Master domains: organizations, users, projects, routes, segments
- Field domains: trench, duct, cable, survey points, closures, photos
- Workflow domains: deviations, approval actions
- Governance domains: SLA snapshots, escalation rules/events, audit export records

## 6.3 Data quality and control points

- Write validation at route handlers
- Completeness gate at submit/sign-off
- Audit logging for key entity changes

## 7. Integration Architecture

## 7.1 Synchronous integrations

- REST APIs for client apps and enterprise systems
- Webhook registration/listing for outbound notifications

## 7.2 Asynchronous integrations

- Domain events emitted to Kafka-compatible bus (when enabled)
- Topic model uses `org_id` scoping (`org.<id>.abd.events`)

## 7.3 Identity federation

- OIDC issuer discovery + JWKS validation
- Role mapping from realm/client claims to app role model
- Keycloak local profile included for dev/test

## 8. Deployment Architecture

## 8.1 Local developer topology

- Docker Compose stack:
  - api, postgres, redis, minio, redpanda, keycloak(+db), signoz, caddy
- Caddy provides unified local entrypoint routing

## 8.2 Kubernetes topology (Helm)

- Helm chart at `helm/digiabd`
- Toggleable components in `values.yaml`
- Templates include Deployments/StatefulSets/Services/Ingress/Secrets/ConfigMaps

## 8.3 Image pipeline

- Packer template (`packer.pkr.hcl`) builds API and web images from Dockerfiles
- Consistent tagging strategy (`<version>` + `latest`)

## 9. Security Architecture

## 9.1 AuthN/AuthZ

- AuthN:
  - internal JWT (dev/hybrid)
  - OIDC JWT validation (Keycloak/enterprise IdP)
- AuthZ:
  - role-based middleware on protected endpoints
  - governance endpoints have stricter role gates

## 9.2 Secrets handling

- Env-driven secrets in local profile
- Helm chart centralizes secret keys via Kubernetes Secret
- Production recommendation: vault/KMS integration

## 9.3 Transport and perimeter

- TLS termination expected at ingress/gateway in production
- Caddy path routing in local stack for unified dev access

## 10. Observability and Operability

- OTel SDK initialized before app module import
- Auto-instrumentation traces + explicit request metrics/logs
- SigNoz local stack with prebuilt API and SRE dashboards
- Smoke scripts for phase-wise runtime validation

## 11. Test Architecture

- Unit tests (service-level)
- API integration tests (`app.inject`) with seeded users/data
- Phase smoke scripts:
  - base, phase2, phase3, phase4
- FR-to-test traceability matrix at `docs/TEST_MATRIX.md`

## 12. Design Decisions and Trade-offs

1. **Hybrid auth support**
   - Pro: easy local onboarding and enterprise OIDC compatibility
   - Trade-off: dual token path complexity
2. **Monolithic API with modular routes**
   - Pro: faster delivery and simpler operational footprint
   - Trade-off: future scale may require service extraction
3. **Compose-first + Helm scaffold**
   - Pro: quick local and cloud transition
   - Trade-off: advanced production concerns need tightening (HA, backup operators, cert management)
4. **SigNoz standalone for local**
   - Pro: fast OTel verification
   - Trade-off: production should use hardened multi-component deployment

## 13. Known Gaps / Future Design Extensions

- HDD crossing API completeness
- OTDR upload endpoint and lifecycle
- Planned-vs-actual GIS overlay
- Versioning and legal-hold retention controls
- Full audit package artifact generation (ZIP/PDF)
- Email/SMS and collaboration integration channels

## 14. References

- `spec.md`
- `docs/FR_TRACEABILITY.md`
- `docs/TEST_MATRIX.md`
- `docs/CODE_FLOW.md`
- `docs/openapi.yaml`
- `docs/OBSERVABILITY.md`
- `docs/HELM.md`
- `docs/PACKER.md`
- `docker-compose.yml`

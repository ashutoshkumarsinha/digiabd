# Code Flow Guide (Beginner Friendly)

This document explains how the codebase works end-to-end so a new developer can follow execution flow without guessing.

## 1) Big Picture

The project is a monorepo with three application surfaces:

- `apps/api`: Fastify + TypeScript backend (source of truth for business logic and data)
- `apps/web`: React portal for project/governance views
- `apps/mobile`: Expo app for field capture and offline sync

Supporting runtime components:

- Postgres/PostGIS (primary data)
- Redis (cache/idempotency support)
- MinIO (object storage for files/photos)
- Redpanda/Kafka (domain events)
- Keycloak (OIDC auth)
- SigNoz + OpenTelemetry (observability)
- Caddy (local reverse proxy)

## 2) API Startup Flow

Main entry file: `apps/api/src/index.ts`

1. Load `.env` (`dotenv/config`)
2. Validate env into typed config (`loadConfig()` in `config.ts`)
3. Start observability first (`initObservability()`)
4. Dynamically import and build app (`buildApp()` in `app.ts`)
5. Start HTTP listener
6. Register signal handlers (`SIGINT`, `SIGTERM`) for graceful shutdown

## 3) API Composition Flow

Core composition file: `apps/api/src/app.ts`

`buildApp()` does this in order:

1. Creates Fastify instance (logger + request IDs)
2. Decorates app with `config`
3. Creates DB pool
4. Initializes optional Kafka event bus
5. Registers platform plugins:
   - CORS
   - JWT
   - multipart upload
   - Swagger + Swagger UI
6. Registers hooks:
   - `onRequest`: request ID header + request timer start
   - `preHandler`: idempotency enforcement for writes
   - `onResponse`: emit OTel metrics + logs
7. Registers route modules (auth, projects, segments, field-capture, workflows, integrations, resilience, governance)
8. Registers global error handler (RFC7807 response shape)
9. Registers `onClose` cleanup for Kafka, Redis, DB pool

## 4) Request Lifecycle (Typical API Call)

Example endpoint: `POST /api/v1/routes/:routeId/segments`

1. Request enters Fastify
2. `onRequest` assigns request timing + response request-id header
3. `preHandler` checks idempotency (for non-GET `/api/v1/*`)
4. Route preHandler `app.authenticate` validates token:
   - OIDC JWT (if enabled), else
   - internal JWT from `/auth/login`
5. Route handler reads typed user (`getAuthUser`)
6. Route executes inside org context (`withOrgContext`) which sets tenant variable in DB transaction
7. Service function writes/reads DB rows
8. Response returned
9. `onResponse` records metrics/log telemetry

## 5) Authentication and Authorization Flow

Key files:

- `apps/api/src/middleware/auth.ts`
- `apps/api/src/auth/oidc.ts`
- `apps/api/src/routes/auth.ts`

### 5.1 Internal login flow (dev/hybrid)

1. `POST /api/v1/auth/login` receives email
2. Queries `users` table for active user
3. Signs internal JWT with claims (`sub`, `orgId`, `email`, `role`, `name`)
4. Client uses token as `Authorization: Bearer ...`

### 5.2 OIDC flow (Keycloak mode)

1. Client obtains OIDC access token from Keycloak
2. API middleware discovers OIDC metadata + JWKS (cached)
3. Validates token signature + issuer + audience
4. Maps claims/roles to internal `AuthUser`
5. Route authorization checks via `requireRoles(...)`

## 6) Data Access and Tenant Isolation

Key file: `apps/api/src/db/pool.ts`

`withOrgContext(pool, orgId, fn)`:

1. Opens DB client and transaction
2. Executes `SET LOCAL app.current_org_id = '<orgId>'`
3. Runs your callback (`fn(client)`)
4. Commits on success, rolls back on error

This pattern keeps org-scoped queries consistent and is the foundation for multi-tenant separation.

## 7) Route Modules and What They Own

- `routes/auth.ts`: login, oidc config, `me`, organizations
- `routes/projects.ts`: projects and project routes
- `routes/segments.ts`: segment list/create/get and trench upsert
- `routes/field-capture.ts`: duct/cable/survey/closure/submit/sign-off/assets/notifications
- `routes/workflows.ts`: deviations, photo uploads, noc lookup
- `routes/integrations.ts`: offline sync, webhooks, SCM stubs
- `routes/resilience.ts`: GIS export, CAD generation, ETL jobs
- `routes/governance.ts`: dashboard, SLA, compliance, escalation engine, executive summary, audit export

## 8) Web App Flow

Main files:

- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/lib/api.ts`

Flow:

1. App mounts in `main.tsx`
2. Login stores token in `localStorage`
3. API helper auto-attaches bearer token on each request
4. User navigates projects -> routes -> segments -> detail/governance
5. UI calls API endpoints directly and renders responses

## 9) Mobile App Flow

Main files:

- `apps/mobile/App.tsx`
- `apps/mobile/src/api.ts`
- `apps/mobile/src/offline.ts`

Flow:

1. Login receives bearer token
2. Field capture can enqueue operations offline (`enqueue`)
3. Queue persists in AsyncStorage
4. Sync button sends queue via `POST /api/v1/sync/batch`
5. On success, queue is cleared

## 10) Observability Flow

Key files:

- `apps/api/src/observability/telemetry.ts`
- `apps/api/src/app.ts` hooks

Flow:

1. OTel SDK initialized before app build
2. Auto-instrumentation generates traces
3. Request hooks emit:
   - `http.server.requests` counter
   - `http.server.duration` histogram
   - structured OTel logs
4. Exporters send to OTLP endpoint (SigNoz by default)

## 11) Local Runtime / Deploy Flow

- `docker-compose.yml`: local integrated stack
- `helm/digiabd`: Kubernetes deployment
- `packer.pkr.hcl`: image build workflow for API and Web
- `Makefile` + root npm scripts: one-command workflows

## 12) “Where do I start?” for new contributors

Recommended reading order:

1. `apps/api/src/index.ts`
2. `apps/api/src/app.ts`
3. `apps/api/src/middleware/auth.ts`
4. Route files in this order:
   - `routes/auth.ts`
   - `routes/projects.ts`
   - `routes/segments.ts`
   - `routes/field-capture.ts`
   - `routes/governance.ts`
5. `apps/web/src/App.tsx`
6. `apps/mobile/App.tsx`
7. `docs/FR_TRACEABILITY.md` and `docs/TEST_MATRIX.md`

## 13) Debugging Checklist by Layer

- Auth issues: check token source (internal JWT vs OIDC JWT), issuer/audience, role claims
- Data issues: confirm `orgId` in token and DB org context
- API errors: inspect RFC7807 `detail` and server logs
- Missing telemetry: verify OTEL env vars + SigNoz endpoint
- UI issues: inspect network tab for failing endpoint and payload


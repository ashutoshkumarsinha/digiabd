# Digital ABD

Enterprise As-Built Documentation platform for Optical Fiber Cable (OFC) networks.

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### 1. Clone and configure

```bash
cp .env.example .env
npm install
```

### 2. Start infrastructure

```bash
npm run db:up
```

This starts PostgreSQL (PostGIS), Redis, MinIO, and Redpanda (Kafka-compatible). The database schema is applied automatically on first boot.

### 3. Start the API (local dev)

```bash
npm run dev
```

- API: http://localhost:3000
- Swagger docs: http://localhost:3000/docs
- Health: http://localhost:3000/health

### 4. Or start the full stack in Docker

```bash
npm run stack:up
```

### 5. Observability (OpenTelemetry + SigNoz)

```bash
npm run observability:up
```

- SigNoz UI: http://localhost:8080
- OTLP gRPC ingest: `localhost:4317`
- OTLP HTTP ingest: `localhost:4318`

The API exports traces, metrics, and OTEL logs via `OTEL_EXPORTER_OTLP_ENDPOINT`.
Import the prebuilt SigNoz dashboard from `observability/signoz/digiabd-api-dashboard.v5.json`.

## Demo Users

| Email | Role |
|---|---|
| admin@demo.telecom | enterprise_admin |
| engineer@demo.telecom | field_engineer |
| oic@demo.telecom | inspector_oic |

## API Quick Test

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"engineer@demo.telecom"}' | jq -r .access_token)

# List projects
curl -s http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" | jq

# Create a segment
ROUTE_ID="d0000000-0000-4000-8000-000000000001"
curl -s -X POST "http://localhost:3000/api/v1/routes/$ROUTE_ID/segments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"chainage_start":0,"chainage_end":500,"surface_type":"urban"}' | jq
```

## Project Structure

```
digiabd/
├── apps/
│   ├── api/              # Node.js + Fastify REST API
│   ├── web/              # React portal (Phase 2 field capture UI)
│   └── mobile/           # Expo field app with offline sync
├── packages/
│   └── shared/           # Shared TypeScript types
├── database/
│   └── migrations/       # PostgreSQL + PostGIS schema
├── docs/
│   ├── MVP_SCOPE.md
│   └── PHASE2_SCOPE.md
```

## Implementation Phases

| Phase | Timeline | Status |
|---|---|---|
| Phase 1 — Foundation | Months 1–3 | Done |
| Phase 2 — Scale | Months 4–6 | Done |
| Phase 3 — Resilience | Months 7–9 | Done |
| Phase 4 — Governance | Months 10–12 | In progress |

See [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md), [docs/PHASE2_SCOPE.md](docs/PHASE2_SCOPE.md), [docs/PHASE3_SCOPE.md](docs/PHASE3_SCOPE.md), and [docs/PHASE4_SCOPE.md](docs/PHASE4_SCOPE.md).

## Documentation

- [Functional Requirements (spec.md)](spec.md)
- [MVP Scope](docs/MVP_SCOPE.md)
- [Phase 2 Scope](docs/PHASE2_SCOPE.md)
- [Phase 3 Scope](docs/PHASE3_SCOPE.md)
- [Phase 4 Scope](docs/PHASE4_SCOPE.md)
- [OpenAPI Spec](docs/openapi.yaml) (v0.4.0 — synced with all Phase 1–4 endpoints)
- [FR Traceability Matrix](docs/FR_TRACEABILITY.md)
- [Observability Guide](docs/OBSERVABILITY.md)
- Live API docs at `/docs` when server is running

# Digital ABD — Phase 3 Scope

**Timeline:** Months 7–9 · **Status:** Done

## Delivered in Phase 3

| Area | Capability | Status |
|---|---|---|
| GIS Export | Route GeoJSON endpoint | Done |
| WMS Capability | WMS capability descriptor endpoint | Done |
| ETL Jobs | Job queue API + persistence | Done |
| CAD Artifacts | As-built artifact generation + storage record | Done |
| Data Snapshotting | GIS layer snapshot table and API-side registration | Done |
| CI Pipeline | Phase 3 migration wired in CI | Done |

## New API Endpoints (Phase 3)

```
GET  /api/v1/gis/wms/capabilities
GET  /api/v1/gis/routes/:routeId/geojson
POST /api/v1/cad/routes/:routeId/generate
GET  /api/v1/cad/routes/:routeId/artifacts
POST /api/v1/etl/routes/:routeId/jobs
GET  /api/v1/etl/jobs
```

## Run Phase 3

```bash
npm install
npm run db:up
npm run db:migrate:phase2
npm run db:migrate:phase3
npm run dev
bash scripts/smoke-test-phase3.sh
```

## Deferred to Phase 4

- Multi-AZ infra and automated regional failover
- Live GIS server integration (GeoServer/MapServer)
- Full AutoCAD/DWG pipeline (replacing JSON placeholder artifact)
- Data warehouse + SLA governance dashboards
- Compliance certification evidence automation

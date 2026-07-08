# Observability (OpenTelemetry + SigNoz)

Digital ABD API now emits OpenTelemetry traces, metrics, and logs.

## What is instrumented

- Auto-instrumented traces via OpenTelemetry Node SDK (HTTP/Fastify/DB and other supported libs)
- HTTP request metrics:
  - `http.server.requests` (counter)
  - `http.server.duration` (histogram, milliseconds)
- OTEL logs for request completion and server errors

## Runtime configuration

Use these environment variables:

- `OTEL_ENABLED` (default `true`)
- `OTEL_SERVICE_NAME` (default `digiabd-api`)
- `OTEL_SERVICE_VERSION` (default `0.4.0`)
- `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`)
- `OTEL_EXPORTER_OTLP_HEADERS` (optional, `key=value,key2=value2`)
- `OTEL_METRIC_EXPORT_INTERVAL_MS` (default `10000`)

## SigNoz local stack

The repository `docker-compose.yml` includes a `signoz` service (`signoz/signoz-standalone:latest`).

Start SigNoz only:

```bash
npm run observability:up
```

Start full stack including API:

```bash
npm run stack:up
```

SigNoz endpoints:

- UI: `http://localhost:8080`
- OTLP gRPC: `localhost:4317`
- OTLP HTTP: `localhost:4318`

## Prebuilt dashboard

A ready-to-import dashboard is included at:

- `observability/signoz/digiabd-api-dashboard.v5.json`
- `observability/signoz/digiabd-sre-dashboard.v5.json`

Import in SigNoz:

1. Open `http://localhost:8080`
2. Go to **Dashboards**
3. Click **Import JSON**
4. Select `observability/signoz/digiabd-api-dashboard.v5.json`
5. Save as `Digital ABD API Monitoring`

Panels included:

- API throughput (traces)
- API p95 latency (traces)
- API error spans (traces)
- Log volume by severity (logs)
- Top routes by average latency (traces)

The SRE dashboard includes:

- Request rate + 5xx counts (server spans)
- Postgres p95 latency (client spans)
- Redis p95 latency (client spans)
- Slowest spans (avg ms)

## Verification

1. Start SigNoz and API.
2. Hit a few API endpoints (`/health`, `/api/v1/projects`).
3. In SigNoz UI, check:
   - **Traces** for `digiabd-api`
   - **Metrics** for `http.server.requests` and `http.server.duration`
   - **Logs** filtered by service `digiabd-api`

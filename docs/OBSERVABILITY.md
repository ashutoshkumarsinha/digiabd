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

## Verification

1. Start SigNoz and API.
2. Hit a few API endpoints (`/health`, `/api/v1/projects`).
3. In SigNoz UI, check:
   - **Traces** for `digiabd-api`
   - **Metrics** for `http.server.requests` and `http.server.duration`
   - **Logs** filtered by service `digiabd-api`

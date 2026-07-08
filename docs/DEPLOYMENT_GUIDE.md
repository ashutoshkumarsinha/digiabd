# Deployment Guide — Digital ABD

## 1. Overview

This guide covers all supported deployment modes:

1. Local developer stack (Docker Compose)
2. Container image build (Packer)
3. Kubernetes deployment (Helm)

It also includes post-deploy verification, smoke validation, and rollback basics.

## 2. Prerequisites

Required tools:

- Docker Engine + Docker Compose v2
- Node.js 20+
- `jq`
- Packer (for image builds)
- Helm + kubectl (for Kubernetes deployments)

Optional:

- Make (shortcut workflows)

## 3. Configuration baseline

## 3.1 Environment file

Create `.env` from template:

```bash
cp .env.example .env
```

Key variables to review:

- `JWT_SECRET`
- `DATABASE_URL`
- `AUTH_MODE`
- `OIDC_ISSUER`, `OIDC_CLIENT_ID`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

## 3.2 Recommended local profile

- `AUTH_MODE=hybrid`
- OIDC values pointed to local Keycloak if enabled
- OTEL endpoint to local SigNoz (`http://localhost:4318`)

## 4. Local deployment (Docker Compose)

## 4.1 Start core dependencies

```bash
npm run db:up
```

Starts:

- postgres, redis, minio, minio-init, redpanda

## 4.2 Apply migrations

```bash
npm run db:migrate
```

Applies migrations 001→004.

## 4.3 Optional services

- Keycloak:
  ```bash
  npm run keycloak:up
  ```
- SigNoz:
  ```bash
  npm run observability:up
  ```
- Caddy proxy:
  ```bash
  npm run proxy:up
  ```

## 4.4 Start app services

Development mode:

```bash
npm run dev
npm run dev:web
```

Or full compose stack:

```bash
npm run stack:up
```

## 4.5 Validate deployment

```bash
npm run smoke
npm run smoke:phase2
npm run smoke:phase3
npm run smoke:phase4
```

## 5. Image build and publish flow

## 5.1 Build images with Packer

```bash
packer init .
packer build -var "version=dev" .
```

Outputs:

- `digiabd/api:<version>`
- `digiabd/web:<version>`

## 5.2 Registry tagging (example)

```bash
docker tag digiabd/api:dev <registry>/digiabd/api:0.4.0
docker tag digiabd/web:dev <registry>/digiabd/web:0.4.0
docker push <registry>/digiabd/api:0.4.0
docker push <registry>/digiabd/web:0.4.0
```

## 6. Kubernetes deployment (Helm)

## 6.1 Lint and render

```bash
helm lint ./helm/digiabd
helm template digiabd ./helm/digiabd -n digiabd
```

## 6.2 Install/upgrade

```bash
helm upgrade --install digiabd ./helm/digiabd -n digiabd --create-namespace
```

## 6.3 Common overrides

```bash
helm upgrade --install digiabd ./helm/digiabd \
  -n digiabd --create-namespace \
  --set api.image.repository=<registry>/digiabd/api \
  --set api.image.tag=0.4.0 \
  --set web.image.repository=<registry>/digiabd/web \
  --set web.image.tag=0.4.0 \
  --set caddy.ingress.enabled=true \
  --set caddy.ingress.host=digiabd.example.com
```

## 6.4 Access services (without ingress)

```bash
kubectl -n digiabd port-forward svc/digiabd-digiabd-caddy 8088:8088
```

Then access `http://localhost:8088`.

## 7. Post-deploy verification checklist

1. Health endpoint returns `ok`
2. Swagger UI accessible
3. Login works (dev or OIDC path)
4. Project list and segment create work
5. Governance dashboard endpoints return data
6. OTel traces/metrics/logs visible in SigNoz
7. Keycloak OIDC token accepted by API (if enabled)

## 8. CI/CD alignment

Current CI (`.github/workflows/ci.yml`) performs:

- dependency install
- migration apply (001–004)
- lint
- API tests
- API build

Recommended next enhancements:

- add Helm lint/template stage
- add image build stage (Packer or Docker Buildx)
- add smoke stage against ephemeral environment

## 9. Rollback strategy

## 9.1 Compose rollback

- Re-run previous image tags in compose file or restore previous branch version.
- Recreate services:
  ```bash
  npm run stack:down
  npm run stack:up
  ```

## 9.2 Helm rollback

```bash
helm history digiabd -n digiabd
helm rollback digiabd <REVISION> -n digiabd
```

## 9.3 Data rollback

- Prefer forward-fix migrations.
- Use DB backups/snapshots for severe schema/data incidents.
- Validate tenancy and critical flows after restore.

## 10. Security and operations hardening (production)

- Replace default secrets and admin credentials.
- Use managed database/object storage where possible.
- Enforce TLS at ingress/gateway.
- Restrict egress and apply network policies.
- Integrate secret manager (Vault/KMS) instead of plain env values.
- Enable vulnerability scanning and image signing.
- Pin auth libraries to patched versions and avoid floating `latest` in production manifests.
- OIDC verifier in API accepts only compact JWS JWT format (rejects non-3-part tokens by design).
- Block direct `/metrics` and `/debug/*` edge access unless explicitly required and protected.

## 11. Troubleshooting

- API fails to start:
  - check `DATABASE_URL`, `JWT_SECRET`, DB readiness
- OIDC failures:
  - verify issuer URL, audience/client ID, JWKS reachability
- Missing traces:
  - verify `OTEL_ENABLED` and OTLP endpoint
- Failed smoke tests:
  - ensure migrations applied and services healthy
- Helm install issues:
  - run `helm template` and inspect generated resources

## 12. Command quick reference

```bash
# Local
npm run setup
npm run db:up
npm run db:migrate
npm run keycloak:up
npm run observability:up
npm run proxy:up
npm run dev
npm run dev:web

# Validation
npm run smoke
npm run smoke:phase4

# Packaging/deploy
npm run images:build
npm run helm:lint
npm run helm:install
```

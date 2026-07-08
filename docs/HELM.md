# Helm Deployment

This repository now includes a Helm chart at `helm/digiabd`.

## What gets deployed

- `api` (Digital ABD API)
- `web` (frontend)
- `postgres` (PostGIS)
- `redis`
- `minio`
- `redpanda`
- `keycloak-db`
- `keycloak`
- `signoz`
- `caddy` (+ optional ingress)

Each component can be enabled/disabled in `helm/digiabd/values.yaml`.

## Install

```bash
helm upgrade --install digiabd ./helm/digiabd -n digiabd --create-namespace
```

## Useful overrides

```bash
helm upgrade --install digiabd ./helm/digiabd \
  -n digiabd --create-namespace \
  --set api.image.repository=digiabd/api \
  --set api.image.tag=latest \
  --set web.image.repository=digiabd/web \
  --set web.image.tag=latest \
  --set caddy.ingress.enabled=true \
  --set caddy.ingress.host=digiabd.example.com
```

## Access

If ingress is disabled:

```bash
kubectl -n digiabd port-forward svc/digiabd-digiabd-caddy 8088:8088
```

Then open `http://localhost:8088`.


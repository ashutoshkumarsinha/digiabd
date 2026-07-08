# Packer (build all Docker images)

This repo includes a Packer template that builds all **project-owned** Docker images (not upstream dependencies like Postgres/Redis/Keycloak/SigNoz).

## Images produced

- `digiabd/api:<version>` and `digiabd/api:latest` (from `apps/api/Dockerfile`)
- `digiabd/web:<version>` and `digiabd/web:latest` (from `apps/web/Dockerfile`)

## Prerequisites

- Docker Engine
- Packer

## Build

```bash
packer init .
packer build -var "version=dev" .
```

After build:

```bash
docker images | grep digiabd
```

## Custom repository prefix

```bash
packer build -var "repo_prefix=myorg/digiabd" -var "version=0.4.0" .
```


# Caddy Reverse Proxy (Local Dev)

This project includes **Caddy** as a local reverse-proxy so you can access API, Keycloak, and SigNoz from a single base URL.

## Start

```bash
npm run proxy:up
```

## Endpoints (via Caddy)

Base: `http://localhost:8088`

- API: `http://localhost:8088/api/v1/`
- Swagger: `http://localhost:8088/docs`
- Keycloak: `http://localhost:8088/auth`
- SigNoz: `http://localhost:8088/signoz`

## Config

- Caddy config: `Caddyfile`
- Docker service: `caddy` in `docker-compose.yml`

If you change internal ports/services, update the `reverse_proxy` targets in `Caddyfile`.


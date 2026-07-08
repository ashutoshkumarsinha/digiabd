SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help setup dev dev-web dev-mobile build build-api build-web test lint \
        db-up db-down db-migrate infra-up infra-down \
        keycloak-up keycloak-down signoz-up signoz-down proxy-up proxy-down \
        smoke smoke2 smoke3 smoke4 images-build helm-lint helm-template helm-install helm-uninstall

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Install deps and initialize .env
	npm run setup

dev: ## Run API dev server
	npm run dev

dev-web: ## Run web dev server
	npm run dev:web

dev-mobile: ## Run mobile dev server
	npm run dev:mobile

build: ## Build API and web
	npm run build

build-api: ## Build API only
	npm run build:api

build-web: ## Build web only
	npm run build:web

test: ## Run API tests
	npm run test:api

lint: ## Run API lint/typecheck
	npm run lint:api

db-up: ## Start core data services
	npm run db:up

db-down: ## Stop all compose services
	npm run db:down

db-migrate: ## Apply all DB migrations (001-004)
	npm run db:migrate

infra-up: ## Start full local stack
	npm run stack:up

infra-down: ## Stop full local stack
	npm run stack:down

keycloak-up: ## Start Keycloak + DB
	npm run keycloak:up

keycloak-down: ## Stop Keycloak + DB
	npm run keycloak:down

signoz-up: ## Start SigNoz
	npm run observability:up

signoz-down: ## Stop SigNoz
	npm run observability:down

proxy-up: ## Start Caddy reverse proxy
	npm run proxy:up

proxy-down: ## Stop Caddy reverse proxy
	npm run proxy:down

smoke: ## Run base smoke test
	npm run smoke

smoke2: ## Run Phase 2 smoke test
	npm run smoke:phase2

smoke3: ## Run Phase 3 smoke test
	npm run smoke:phase3

smoke4: ## Run Phase 4 smoke test
	npm run smoke:phase4

images-build: ## Build API+web images via Packer
	npm run images:build

helm-lint: ## Lint Helm chart
	npm run helm:lint

helm-template: ## Render Helm templates
	npm run helm:template

helm-install: ## Install/upgrade Helm release
	npm run helm:install

helm-uninstall: ## Remove Helm release
	npm run helm:uninstall

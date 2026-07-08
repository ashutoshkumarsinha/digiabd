# Digital ABD — Phase 2 Scope

**Timeline:** Months 4–6 · **Status:** Done

## Delivered in Phase 2

| Area | Capability | Status |
|---|---|---|
| **Event Bus** | Redpanda (Kafka-compatible) + domain event publishing | Done |
| **Webhooks** | HMAC-signed delivery, subscription admin API | Done |
| **Idempotency** | Redis + DB backed `Idempotency-Key` header | Done |
| **Field Capture** | Duct, cable, survey points, joint closures | Done |
| **Workflow** | Segment submit (completeness gate) + OIC sign-off | Done |
| **Offline Sync** | `POST /api/v1/sync/batch` for mobile queue replay | Done |
| **Notifications** | In-app notifications on domain events | Done |
| **Asset Master** | Cable drum / asset registry API | Done |
| **SCM Integration** | Materials stub + receipt endpoint | Done |
| **OIDC** | Config endpoint + hybrid auth mode (callback Phase 2.1) | Partial |
| **Mobile App** | Expo field app with offline queue + GPS capture | Done |
| **Web Portal** | Projects → routes → segments → capture forms | Done |
| **Shared Types** | `@digiabd/shared` package | Done |

## Phase 2 Exit Criteria

- [ ] Redpanda running; events published on segment submit/sign-off and deviations
- [ ] Webhook delivered to subscriber with valid HMAC signature
- [ ] Mobile offline queue syncs via batch API
- [ ] Full field capture: trench + duct + cable + submit workflow
- [ ] Idempotent replay returns same response without duplicate records
- [ ] Web portal navigates full project hierarchy

## Deferred to Phase 3

- GIS ETL pipeline and AutoCAD export
- Multi-AZ / DR region
- Data warehouse ETL
- Full OIDC code exchange with Azure AD / Okta
- OTDR file parsing automation
- Photo capture from mobile camera (upload API ready)

## New API Endpoints (Phase 2)

```
GET  /api/v1/segments/:id/detail
PUT  /api/v1/segments/:id/duct
POST /api/v1/segments/:id/cables
POST /api/v1/segments/:id/survey-points
POST /api/v1/segments/:id/closures
POST /api/v1/segments/:id/submit
POST /api/v1/segments/:id/sign-off
POST /api/v1/sync/batch
GET  /api/v1/webhooks
POST /api/v1/webhooks
GET  /api/v1/notifications
GET  /api/v1/assets
POST /api/v1/assets
GET  /api/v1/integrations/scm/materials
POST /api/v1/integrations/scm/receipts
GET  /api/v1/auth/oidc/config
```

## Run Phase 2 Stack

```bash
npm install
npm run db:up
npm run db:migrate:phase2   # if DB already initialized
npm run dev                   # API
npm run dev:web               # Portal
npm run dev:mobile            # Expo field app
bash scripts/smoke-test-phase2.sh
```

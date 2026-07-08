import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { getAuthUser } from '../middleware/auth.js';
import type { AppConfig } from '../config.js';
import { getAuthUser } from '../middleware/auth.js';
import { getIdempotencyKey, storeIdempotency } from '../middleware/idempotency.js';
import { emitAbdEvent } from '../services/webhooks.js';
import { executeSyncItem, processSyncBatch, type SyncItem } from '../services/sync.js';
import { listWebhooks, createWebhook } from '../services/webhooks.js';
import { withOrgContext } from '../db/pool.js';

export async function registerSyncRoutes(app: FastifyInstance, pool: pg.Pool, config: AppConfig): Promise<void> {
  app.post('/api/v1/sync/batch', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = getAuthUser(request);
    const body = request.body as { device_id?: string; items: SyncItem[] };

    if (!body?.items?.length) {
      return reply.status(400).send({
        type: 'https://digiabd.io/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'items array is required',
      });
    }

    const result = await processSyncBatch(pool, user.orgId, user.sub, body.device_id, body.items, (client, item) =>
      executeSyncItem(client, user.orgId, user.sub, item),
    );

    const response = {
      batch_id: result.batch_id,
      status: result.error_count === 0 ? 'completed' : result.success_count === 0 ? 'failed' : 'partial',
      success_count: result.success_count,
      error_count: result.error_count,
      results: result.results,
    };

    const idempotencyKey = getIdempotencyKey(request);
    if (idempotencyKey) {
      await storeIdempotency(pool, config, user.orgId, idempotencyKey, request.url, 200, response);
    }

    for (const r of result.results) {
      if (r.status === 'ok' && r.entity_id) {
        void emitAbdEvent(pool, user.orgId, 'abd.segment.created', { entity_id: r.entity_id, client_id: r.client_id });
      }
    }

    return reply.send(response);
  });
}

export async function registerWebhookAdminRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  app.get('/api/v1/webhooks', { preHandler: [app.authenticate] }, async (request) => {
    const user = getAuthUser(request);
    return withOrgContext(pool, user.orgId, (client) => listWebhooks(client, user.orgId));
  });

  app.post('/api/v1/webhooks', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = getAuthUser(request);
    const body = request.body as { name: string; url: string; events: string[]; secret?: string };
    if (!body?.name || !body?.url || !body?.events?.length) {
      return reply.status(400).send({
        type: 'https://digiabd.io/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'name, url, and events are required',
      });
    }
    const webhook = await withOrgContext(pool, user.orgId, (client) => createWebhook(client, user.orgId, body));
    return reply.status(201).send(webhook);
  });
}

export async function registerIntegrationRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  app.get('/api/v1/integrations/scm/materials', { preHandler: [app.authenticate] }, async (request) => {
    const user = getAuthUser(request);
    const { rows } = await pool.query(
      `SELECT * FROM integration_endpoints WHERE org_id = $1 AND system_type = 'scm' AND is_active = TRUE LIMIT 1`,
      [user.orgId],
    );

    // SCM stub — returns demo material data; replace with live SCM API call
    return {
      integration: rows[0] ?? null,
      materials: [
        { serial_number: 'DRUM-2026-001', type: 'cable_drum', core_count: 48, manufacturer: 'Sterlite' },
        { serial_number: 'DRUM-2026-002', type: 'cable_drum', core_count: 96, manufacturer: 'Corning' },
        { serial_number: 'DUCT-HDPE-40', type: 'duct', diameter_mm: 40, manufacturer: 'Supreme' },
      ],
    };
  });

  app.post('/api/v1/integrations/scm/receipts', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as { serial_number: string; project_id: string; received_at?: string };
    if (!body?.serial_number || !body?.project_id) {
      return reply.status(400).send({
        type: 'https://digiabd.io/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'serial_number and project_id are required',
      });
    }
    // SCM receipt stub
    return reply.status(201).send({
      receipt_id: crypto.randomUUID(),
      status: 'recorded',
      ...body,
      recorded_at: new Date().toISOString(),
    });
  });
}

import type pg from 'pg';
import type { DbClient } from '../db/pool.js';
import { publishEvent, signWebhookPayload, type AbdEvent } from './events.js';
import type { AbdEventType } from '../types/events.js';

interface WebhookSubscription {
  id: string;
  url: string;
  secret: string;
  events: string[];
}

export async function emitAbdEvent(
  pool: pg.Pool,
  orgId: string,
  eventType: AbdEventType,
  payload: Record<string, unknown>,
  correlationId?: string,
): Promise<void> {
  const event: AbdEvent = {
    event_id: crypto.randomUUID(),
    event_type: eventType,
    event_version: '1.0',
    timestamp: new Date().toISOString(),
    org_id: orgId,
    correlation_id: correlationId,
    payload,
  };

  await publishEvent(event);
  await deliverWebhooks(pool, orgId, event);
  await createNotification(pool, orgId, event);
}

async function getActiveWebhooks(pool: pg.Pool, orgId: string, eventType: string): Promise<WebhookSubscription[]> {
  const { rows } = await pool.query<WebhookSubscription>(
    `SELECT id, url, secret, events FROM webhook_subscriptions
     WHERE org_id = $1 AND is_active = TRUE AND $2 = ANY(events)`,
    [orgId, eventType],
  );
  return rows;
}

async function deliverWebhooks(pool: pg.Pool, orgId: string, event: AbdEvent): Promise<void> {
  const webhooks = await getActiveWebhooks(pool, orgId, event.event_type);
  const body = JSON.stringify(event);

  await Promise.allSettled(
    webhooks.map(async (wh) => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = signWebhookPayload(wh.secret, body, timestamp);

      const response = await fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ABD-Event': event.event_type,
          'X-ABD-Signature': `sha256=${signature}`,
          'X-ABD-Timestamp': timestamp,
          'X-Request-ID': event.event_id,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`Webhook ${wh.id} failed: ${response.status}`);
      }
    }),
  );
}

async function createNotification(pool: pg.Pool, orgId: string, event: AbdEvent): Promise<void> {
  const titles: Partial<Record<AbdEventType, string>> = {
    'abd.segment.completed': 'Segment Completed',
    'abd.segment.submitted': 'Segment Submitted for Review',
    'abd.deviation.created': 'New Deviation Reported',
    'abd.deviation.approved': 'Deviation Approved',
  };

  const title = titles[event.event_type];
  if (!title) return;

  await pool.query(
    `INSERT INTO notifications (org_id, channel, event_type, title, body, metadata)
     VALUES ($1, 'in_app', $2, $3, $4, $5)`,
    [orgId, event.event_type, title, JSON.stringify(event.payload), JSON.stringify({ event_id: event.event_id })],
  );
}

export async function listWebhooks(client: DbClient, orgId: string) {
  const { rows } = await client.query(
    `SELECT id, name, url, events, is_active, created_at FROM webhook_subscriptions WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId],
  );
  return rows;
}

export async function createWebhook(
  client: DbClient,
  orgId: string,
  data: { name: string; url: string; events: string[]; secret?: string },
) {
  const secret = data.secret ?? crypto.randomUUID();
  const { rows } = await client.query(
    `INSERT INTO webhook_subscriptions (org_id, name, url, secret, events)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, url, events, is_active, created_at`,
    [orgId, data.name, data.url, secret, data.events],
  );
  return rows[0];
}

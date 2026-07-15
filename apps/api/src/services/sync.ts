import type pg from 'pg';
import type { DbClient } from '../db/pool.js';
import * as abd from './abd.js';
import * as field from './field-capture.js';

export interface SyncItem {
  client_id: string;
  operation: string;
  payload: Record<string, unknown>;
}

export interface SyncItemResult {
  client_id: string;
  status: 'ok' | 'error';
  entity_id?: string;
  error?: string;
}

export async function processSyncBatch(
  pool: pg.Pool,
  orgId: string,
  userId: string,
  deviceId: string | undefined,
  items: SyncItem[],
  processItem: (client: DbClient, item: SyncItem) => Promise<SyncItemResult>,
): Promise<{ batch_id: string; results: SyncItemResult[]; success_count: number; error_count: number }> {
  const { rows: batchRows } = await pool.query<{ id: string }>(
    `INSERT INTO sync_batches (org_id, user_id, device_id, item_count, status)
     VALUES ($1, $2, $3, $4, 'processing')
     RETURNING id`,
    [orgId, userId, deviceId ?? null, items.length],
  );
  const batchId = batchRows[0].id;

  const client = await pool.connect();
  const results: SyncItemResult[] = [];

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_org_id = '${orgId}'`);

    for (const item of items) {
      try {
        const result = await processItem(client, item);
        results.push(result);
      } catch (error: any) {
        results.push({
          client_id: item.client_id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'ok').length;
    const errorCount = results.filter((r) => r.status === 'error').length;
    const status = errorCount === 0 ? 'completed' : successCount === 0 ? 'failed' : 'partial';

    await client.query(
      `UPDATE sync_batches SET status = $1, success_count = $2, error_count = $3,
       errors = $4, completed_at = NOW() WHERE id = $5`,
      [status, successCount, errorCount, JSON.stringify(results.filter((r) => r.status === 'error')), batchId],
    );

    await client.query('COMMIT');
    return { batch_id: batchId, results, success_count: successCount, error_count: errorCount };
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function executeSyncItem(
  client: DbClient,
  orgId: string,
  userId: string,
  item: SyncItem,
): Promise<SyncItemResult> {
  switch (item.operation) {
    case 'create_segment': {
      const p = item.payload as { route_id: string; chainage_start: number; chainage_end: number; surface_type?: string };
      const segment = await abd.createSegment(client, orgId, userId, p);
      return { client_id: item.client_id, status: 'ok', entity_id: segment.id };
    }
    case 'upsert_trench': {
      const p = item.payload as { segment_id: string; depth_m: number; width_m?: number; bedding_type?: string };
      await abd.upsertTrenchRecord(client, orgId, p.segment_id, p);
      return { client_id: item.client_id, status: 'ok', entity_id: p.segment_id };
    }
    case 'upsert_duct': {
      const p = item.payload as { segment_id: string; duct_type: string; diameter_mm?: number; duct_count?: number };
      await field.upsertDuctRecord(client, orgId, p.segment_id, p);
      return { client_id: item.client_id, status: 'ok', entity_id: p.segment_id };
    }
    case 'upsert_cable': {
      const p = item.payload as { segment_id: string; core_count: number; laid_length_m: number; drum_number?: string };
      const cable = await field.createCableRecord(client, orgId, p.segment_id, p);
      return { client_id: item.client_id, status: 'ok', entity_id: cable.id };
    }
    case 'create_deviation': {
      const p = item.payload as { segment_id: string; category: string; description: string; justification?: string };
      const deviation = await abd.createDeviation(client, orgId, userId, p);
      return { client_id: item.client_id, status: 'ok', entity_id: deviation.id };
    }
    default:
      return { client_id: item.client_id, status: 'error', error: `Unknown operation: ${item.operation}` };
  }
}

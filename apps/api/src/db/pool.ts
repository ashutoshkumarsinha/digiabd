import pg from 'pg';
import type { AppConfig } from './config.js';

const { Pool } = pg;

export type DbClient = pg.PoolClient;

export function createPool(config: AppConfig): pg.Pool {
  return new Pool({ connectionString: config.DATABASE_URL });
}

export async function withOrgContext<T>(
  pool: pg.Pool,
  orgId: string,
  fn: (client: DbClient) => Promise<T>,
): Promise<T> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId)) {
    throw new Error('Invalid organization ID');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_org_id = '${orgId}'`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T extends pg.QueryResultRow>(
  pool: pg.Pool,
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

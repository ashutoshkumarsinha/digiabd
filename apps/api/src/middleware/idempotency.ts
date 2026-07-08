import type { FastifyReply, FastifyRequest } from 'fastify';
import type Redis from 'ioredis';
import type pg from 'pg';
import type { AppConfig } from '../config.js';
import { getRedis } from '../db/redis.js';
import { getAuthUser } from '../middleware/auth.js';

const IDEMPOTENCY_HEADER = 'idempotency-key';

export async function checkIdempotency(
  pool: pg.Pool,
  config: AppConfig,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const key = request.headers[IDEMPOTENCY_HEADER] as string | undefined;
  if (!key || request.method === 'GET' || request.method === 'DELETE') {
    return true;
  }

  let orgId: string | undefined;
  try {
    orgId = getAuthUser(request).orgId;
  } catch {
    return true;
  }

  const redis = getRedis(config);
  const cacheKey = `idempotency:${orgId}:${key}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { status: number; body: unknown };
      reply.status(parsed.status).send(parsed.body);
      return false;
    }
  }

  const { rows } = await pool.query<{ response_status: number; response_body: unknown }>(
    `SELECT response_status, response_body FROM idempotency_keys
     WHERE org_id = $1 AND idempotency_key = $2 AND expires_at > NOW()`,
    [orgId, key],
  );

  if (rows[0]) {
    reply.status(rows[0].response_status).send(rows[0].response_body);
    return false;
  }

  return true;
}

export async function storeIdempotency(
  pool: pg.Pool,
  config: AppConfig,
  orgId: string,
  key: string,
  path: string,
  status: number,
  body: unknown,
): Promise<void> {
  const redis = getRedis(config);
  const cacheKey = `idempotency:${orgId}:${key}`;
  const payload = JSON.stringify({ status, body });

  if (redis) {
    await redis.setex(cacheKey, 86400, payload);
  }

  await pool.query(
    `INSERT INTO idempotency_keys (org_id, idempotency_key, request_path, response_status, response_body)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (org_id, idempotency_key) DO NOTHING`,
    [orgId, key, path, status, JSON.stringify(body)],
  );
}

export function getIdempotencyKey(request: FastifyRequest): string | undefined {
  return request.headers[IDEMPOTENCY_HEADER] as string | undefined;
}

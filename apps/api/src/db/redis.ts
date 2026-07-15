import { Redis } from 'ioredis';
import type { AppConfig } from '../config.js';

let redis: Redis | null = null;

export function getRedis(config: AppConfig): Redis | null {
  if (!config.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

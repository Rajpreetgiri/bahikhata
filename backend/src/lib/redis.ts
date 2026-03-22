import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedis(): Redis | null {
  return redisClient;
}

export function connectRedis(): void {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('⚠️  REDIS_URL not set — rate limiting and idempotency will use in-memory fallback (not suitable for multi-instance)');
    return;
  }

  redisClient = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) return null;
      return Math.min(times * 200, 3000);
    },
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 2000,
  });

  redisClient.on('connect', () => console.log('✅ Redis connected'));
  redisClient.on('error', (err: Error) => {
    // Don't crash on Redis errors — log and degrade gracefully
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'ERROR', service: 'redis', message: err.message }));
  });
  redisClient.on('close', () => console.warn('⚠️  Redis connection closed'));

  redisClient.connect().catch((err: Error) => {
    console.error('❌ Redis connection failed:', err.message);
    redisClient = null;
  });
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
  }
}

/**
 * Atomic increment with expiry (Lua script ensures atomicity).
 * Returns the new counter value. Sets TTL only on the first increment.
 */
const INCR_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

export async function redisIncr(key: string, ttlSeconds: number): Promise<number> {
  const redis = getRedis();
  if (!redis) return 1;
  return (await redis.eval(INCR_SCRIPT, 1, key, String(ttlSeconds))) as number;
}

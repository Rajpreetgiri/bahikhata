/**
 * Idempotency middleware for POST mutations.
 *
 * Client sends: `Idempotency-Key: <uuid>` header.
 * - First request  → process normally, cache response for 24h
 * - Duplicate      → return cached response immediately
 * - No key         → pass through (idempotency is optional)
 *
 * Storage: Redis when available (required for multi-instance), falls back to
 * in-memory Map for single-instance / local dev.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getRedis } from '../lib/redis';

interface CachedResponse {
  status: number;
  body: unknown;
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TTL_S  = 24 * 60 * 60;

// ── In-memory fallback (single-instance / dev only) ───────────────────────────
const memStore = new Map<string, CachedResponse & { expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memStore) if (v.expiresAt < now) memStore.delete(k);
}, 10 * 60 * 1000);

function makeStoreKey(rawKey: string): string {
  return `idem:${crypto.createHash('sha256').update(rawKey.trim()).digest('hex')}`;
}

function interceptResponse(res: Response, storeKey: string): void {
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const redis = getRedis();
      if (redis) {
        redis.setex(storeKey, TTL_S, JSON.stringify({ status: res.statusCode, body })).catch(() => {});
      } else {
        memStore.set(storeKey, { status: res.statusCode, body, expiresAt: Date.now() + TTL_MS });
      }
    }
    return originalJson(body);
  };
}

export function idempotencyCheck(req: Request, res: Response, next: NextFunction): void {
  const rawKey = req.headers['idempotency-key'];
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) return next();

  const storeKey = makeStoreKey(rawKey);
  const redis = getRedis();

  if (redis) {
    redis.get(storeKey)
      .then((cached) => {
        if (cached) {
          const parsed = JSON.parse(cached) as CachedResponse;
          res.status(parsed.status).json(parsed.body);
          return;
        }
        interceptResponse(res, storeKey);
        next();
      })
      .catch(() => {
        // Redis failure → degrade gracefully, skip idempotency check
        next();
      });
  } else {
    const cached = memStore.get(storeKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.status(cached.status).json(cached.body);
      return;
    }
    interceptResponse(res, storeKey);
    next();
  }
}

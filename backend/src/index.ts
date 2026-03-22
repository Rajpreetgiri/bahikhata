import 'dotenv/config';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit, { Store, Options } from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import { connectRedis, disconnectRedis, getRedis, redisIncr } from './lib/redis';

import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import transactionRoutes from './routes/transactions';
import reminderRoutes from './routes/reminders';
import paymentRoutes from './routes/payments';
import reportRoutes from './routes/reports';
import productRoutes from './routes/products';
import invoiceRoutes from './routes/invoices';
import payoutRoutes from './routes/payout';
import supplierRoutes from './routes/suppliers';
import supplierTransactionRoutes from './routes/supplierTransactions';
import historyRoutes from './routes/history';
import expenseRoutes from './routes/expenses';
import notificationRoutes from './routes/notifications';
import walletRoutes from './routes/wallet';
import adminRoutes from './routes/admin';
import uploadsRoutes from './routes/uploads';
import cashbookRoutes from './routes/cashbook';
import scheduledRemindersRoutes from './routes/scheduledReminders';
import qrRoutes from './routes/qr';
import staffRoutes from './routes/staff';
import employeeRoutes from './routes/employees';
import { startScheduler } from './services/scheduler';
import { errorHandler } from './middleware/errorHandler';
import { requireJson } from './middleware/requireJson';
import { rateLimitLogger } from './middleware/securityLogger';

// ─── Fail fast if critical env vars are missing ───────────────────────────────
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_JWT_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET!.length < 32) {
  console.error('❌ JWT_SECRET must be at least 32 characters long for security');
  process.exit(1);
}
if (process.env.ADMIN_SECRET && process.env.ADMIN_SECRET.length < 20) {
  console.warn('⚠️  ADMIN_SECRET is shorter than 20 characters — consider a longer secret');
}
if (!process.env.FAST2SMS_API_KEY) console.warn('⚠️  FAST2SMS_API_KEY not set — SMS reminders will be disabled');
if (!process.env.RAZORPAY_WEBHOOK_SECRET) console.warn('⚠️  RAZORPAY_WEBHOOK_SECRET not set — webhook verification will fail');
if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) console.warn('⚠️  Gmail credentials not set — email sending will fail');

// ─── Redis-backed rate-limit store factory ────────────────────────────────────
// Falls back to express-rate-limit in-memory store if Redis is unavailable.
// IMPORTANT: Multi-instance deployments REQUIRE Redis for accurate limits.
function makeRedisStore(prefix: string, windowMs: number): Store | undefined {
  const redis = getRedis();
  if (!redis) return undefined;

  const ttlSeconds = Math.ceil(windowMs / 1000);
  return {
    async increment(key: string) {
      const fullKey = `rl:${prefix}:${key}`;
      const count = await redisIncr(fullKey, ttlSeconds);
      return { totalHits: count, resetTime: new Date(Date.now() + windowMs) };
    },
    async decrement(key: string) {
      const r = getRedis();
      if (r) await r.decr(`rl:${prefix}:${key}`).catch(() => {});
    },
    async resetKey(key: string) {
      const r = getRedis();
      if (r) await r.del(`rl:${prefix}:${key}`).catch(() => {});
    },
  } satisfies Store;
}

// ── Rate-limit helpers ────────────────────────────────────────────────────────
const RL_MSG = { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } };

function rl(prefix: string, opts: Partial<Omit<Options, 'store'>>): ReturnType<typeof rateLimit> {
  return rateLimit({
    ...opts,
    standardHeaders: true,
    legacyHeaders: false,
    message: RL_MSG,
    // store is set lazily after Redis connects — but Redis connects before app.listen
    // so this factory is called before routes are registered, Redis is already up.
    store: makeRedisStore(prefix, opts.windowMs as number),
  });
}

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();

// Trust proxy (for accurate IP rate limiting behind Nginx / Cloudflare)
app.set('trust proxy', parseInt(process.env.TRUST_PROXY ?? '0', 10));

// ─── X-Request-ID (distributed tracing) ──────────────────────────────────────
app.use((req, res, next) => {
  const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.headers['x-request-id'] = reqId;
  res.setHeader('X-Request-ID', reqId);
  next();
});

// ─── Security event logging ───────────────────────────────────────────────────
app.use(rateLimitLogger);

// ─── Content-Type enforcement (OWASP A05) ─────────────────────────────────────
app.use(requireJson);

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

// ─── Gzip compression (saves bandwidth on API responses) ─────────────────────
app.use(compression({
  level: 6,
  threshold: 1024, // only compress responses > 1 KB
}));

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (req) => req.path.startsWith('/api/auth') || req.path === '/api/health' || req.path === '/api/ready',
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ─── Rate Limiting (Redis-backed when available) ──────────────────────────────
// Applied AFTER Redis connects — stores are created lazily in rl()

// OTP send — very strict: 5 per hour per IP
app.use('/api/auth/send-otp', rl('otp_send', { windowMs: 60 * 60 * 1000, max: 5 }));

// OTP verify — 10 per 15 min
app.use('/api/auth/verify-otp', rl('otp_verify', { windowMs: 15 * 60 * 1000, max: 10 }));

// SMS reminder — prevent spam: 30 per hour
app.use('/api/reminders/send', rl('reminder_send', { windowMs: 60 * 60 * 1000, max: 30 }));

// Bulk reminder — 3 per hour
app.use('/api/reminders/bulk', rl('reminder_bulk', { windowMs: 60 * 60 * 1000, max: 3 }));

// Payment link creation — 20 per hour
app.use('/api/payments/create-link', rl('payment_link', { windowMs: 60 * 60 * 1000, max: 20 }));

// Admin login — 10 per 15 min
app.use('/api/admin/login', rl('admin_login', { windowMs: 15 * 60 * 1000, max: 10 }));

// Read-heavy endpoints — 200 per 15 min
app.use('/api/customers',    rl('customers',    { windowMs: 15 * 60 * 1000, max: 200 }));
app.use('/api/transactions', rl('transactions', { windowMs: 15 * 60 * 1000, max: 200 }));
app.use('/api/invoices',     rl('invoices',     { windowMs: 15 * 60 * 1000, max: 200 }));

// General API — 300 per 15 min
app.use('/api', rl('general', { windowMs: 15 * 60 * 1000, max: 300 }));

// ─── Static file serving — uploaded photos ────────────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
// Razorpay webhook needs raw body — must be before express.json
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

// ─── NoSQL Injection Prevention ───────────────────────────────────────────────
app.use(mongoSanitize({ replaceWith: '_', allowDots: false }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',                  authRoutes);
app.use('/api/customers',             customerRoutes);
app.use('/api/transactions',          transactionRoutes);
app.use('/api/reminders',             reminderRoutes);
app.use('/api/payments',              paymentRoutes);
app.use('/api/reports',               reportRoutes);
app.use('/api/products',              productRoutes);
app.use('/api/invoices',              invoiceRoutes);
app.use('/api/payout',                payoutRoutes);
app.use('/api/suppliers',             supplierRoutes);
app.use('/api/supplier-transactions', supplierTransactionRoutes);
app.use('/api/history',               historyRoutes);
app.use('/api/expenses',              expenseRoutes);
app.use('/api/notifications',         notificationRoutes);
app.use('/api/wallet',                walletRoutes);
app.use('/api/admin',                 adminRoutes);
app.use('/api/uploads',              uploadsRoutes);
app.use('/api/cashbook',             cashbookRoutes);
app.use('/api/scheduled-reminders',  scheduledRemindersRoutes);
app.use('/api/qr',                   qrRoutes);
app.use('/api/staff',                staffRoutes);
app.use('/api/employees',            employeeRoutes);

// ─── Liveness probe — is the process alive? (used by Docker HEALTHCHECK) ─────
app.get('/api/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown';
  const isHealthy = dbState === 1;
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    data: { status: isHealthy ? 'ok' : 'degraded', db: dbStatus, time: new Date().toISOString() },
  });
});

// ─── Readiness probe — is the app ready to serve traffic? (k8s readinessProbe) ─
app.get('/api/ready', async (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;

  let redisReady = true; // Redis is optional (degrades gracefully)
  const redis = getRedis();
  if (redis) {
    try {
      await redis.ping();
    } catch {
      redisReady = false;
    }
  }

  const allReady = dbReady && redisReady;
  res.status(allReady ? 200 : 503).json({
    success: allReady,
    data: {
      status: allReady ? 'ready' : 'not_ready',
      db:    dbReady    ? 'ok' : 'unavailable',
      redis: redis ? (redisReady ? 'ok' : 'unavailable') : 'not_configured',
    },
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// ─── Global Error Handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ─── Server + MongoDB + Redis startup ─────────────────────────────────────────
const PORT         = parseInt(process.env.PORT ?? '5000', 10);
const MONGODB_URI  = process.env.MONGODB_URI!;

async function connectWithRetry(uri: string, retries = 5, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri, {
        maxPoolSize:              10,   // max concurrent connections per instance
        minPoolSize:               2,   // keep 2 warm
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS:         45000,
        connectTimeoutMS:        10000,
        heartbeatFrequencyMS:    10000,
      });
      console.log('✅ MongoDB connected');
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`⚠️  MongoDB attempt ${attempt}/${retries} failed. Retry in ${delayMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 2, 30_000);
    }
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
let httpServer: http.Server;

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received — starting graceful shutdown`);

  httpServer.close(async () => {
    console.log('HTTP server stopped accepting new connections');
    try {
      await mongoose.connection.close(false);
      console.log('MongoDB connection closed');
    } catch (e) {
      console.error('Error closing MongoDB:', e);
    }
    try {
      await disconnectRedis();
      console.log('Redis connection closed');
    } catch (e) {
      console.error('Error closing Redis:', e);
    }
    console.log('Graceful shutdown complete');
    process.exit(0);
  });

  // Force kill after 30s if server hangs
  setTimeout(() => {
    console.error('Graceful shutdown timed out after 30s — force exiting');
    process.exit(1);
  }, 30_000).unref();
}

process.on('SIGTERM', () => { shutdown('SIGTERM').catch(console.error); });
process.on('SIGINT',  () => { shutdown('SIGINT').catch(console.error); });

// ─── Bootstrap ────────────────────────────────────────────────────────────────
(async () => {
  // 1. Connect Redis first (needed for rate limiters — non-fatal if absent)
  connectRedis();

  // 2. Connect MongoDB (fatal if fails after retries)
  await connectWithRetry(MONGODB_URI);

  // 3. Start HTTP server
  httpServer = http.createServer(app);
  httpServer.listen(PORT, () => {
    console.log(`🚀 UdhaariBook backend running on port ${PORT} (${process.env.NODE_ENV ?? 'development'})`);
  });

  // 4. Start scheduled reminder cron
  startScheduler();
})().catch((err) => {
  console.error('❌ Startup failed:', err);
  process.exit(1);
});

export default app;

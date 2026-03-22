import { Request, Response, NextFunction } from 'express';

export type SecurityEvent =
  | 'AUTH_FAILED'
  | 'OTP_MAX_ATTEMPTS'
  | 'RATE_LIMITED'
  | 'ADMIN_LOGIN_FAILED'
  | 'ADMIN_LOGIN_SUCCESS'
  | 'INVALID_TOKEN'
  | 'NOSQL_INJECTION_ATTEMPT';

interface SecurityLogEntry {
  ts: string;
  event: SecurityEvent;
  ip: string;
  path: string;
  detail?: string;
}

export function logSecurityEvent(
  req: Request,
  event: SecurityEvent,
  detail?: string
): void {
  const entry: SecurityLogEntry = {
    ts: new Date().toISOString(),
    event,
    ip: (req.ip ?? req.socket?.remoteAddress ?? 'unknown').replace('::ffff:', ''),
    path: req.path,
    detail,
  };
  // Structured JSON to stdout — can be piped to log aggregator (CloudWatch, Datadog, etc.)
  console.log(JSON.stringify(entry));
}

// Middleware: detect rate-limit responses and log them
export function rateLimitLogger(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (
      res.statusCode === 429 &&
      body &&
      typeof body === 'object' &&
      (body as Record<string, unknown>).success === false
    ) {
      logSecurityEvent(req, 'RATE_LIMITED', `path=${req.path}`);
    }
    return originalJson(body);
  };
  next();
}

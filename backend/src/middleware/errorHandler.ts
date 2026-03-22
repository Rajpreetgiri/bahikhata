import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

interface MongooseValidationError extends Error {
  errors: Record<string, { message: string }>;
}

interface MongoDuplicateKeyError extends Error {
  code: number;
  keyValue: Record<string, unknown>;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // 1. Operational errors we threw intentionally
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.errorCode, message: err.message },
    });
    return;
  }

  // 2. Mongoose schema validation failure
  if (err.name === 'ValidationError') {
    const ve = err as MongooseValidationError;
    const message = Object.values(ve.errors)
      .map((e) => e.message)
      .join(', ');
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message },
    });
    return;
  }

  // 3. MongoDB duplicate key (e.g. unique email)
  const mongoErr = err as unknown as MongoDuplicateKeyError;
  if (mongoErr.code === 11000) {
    const field = Object.keys(mongoErr.keyValue ?? {})[0] ?? 'field';
    res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_KEY', message: `${field} already exists` },
    });
    return;
  }

  // 4. JWT errors (in case they bubble up outside the auth middleware)
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid token' },
    });
    return;
  }
  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'Token expired. Please login again.' },
    });
    return;
  }

  // 5. Unhandled programming error — structured log for log aggregators (CloudWatch, Datadog)
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'ERROR',
    type: err.constructor?.name ?? 'UnknownError',
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  }));
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}

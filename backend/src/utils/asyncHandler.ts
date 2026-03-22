import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler so that any rejected promise or thrown error
 * is forwarded to Express's next(err) — eliminating try/catch boilerplate.
 *
 * Usage:
 *   router.get('/foo', asyncHandler(async (req, res) => { ... }));
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asyncHandler = (
  fn: (req: any, res: Response, next: NextFunction) => Promise<void>
): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

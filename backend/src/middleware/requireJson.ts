import { Request, Response, NextFunction } from 'express';

/**
 * OWASP A05 — Security Misconfiguration
 * Enforce Content-Type: application/json on mutation requests (POST/PUT/PATCH).
 * Prevents content-type confusion attacks.
 * Exempts the Razorpay webhook which sends raw body.
 */
export function requireJson(req: Request, res: Response, next: NextFunction): void {
  const mutating = ['POST', 'PUT', 'PATCH'].includes(req.method);
  const isWebhook = req.path === '/api/payments/webhook';
  const isUpload  = req.path.startsWith('/api/uploads');

  if (mutating && !isWebhook && !isUpload) {
    const ct = req.headers['content-type'] ?? '';
    if (!ct.includes('application/json')) {
      res.status(415).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Content-Type must be application/json',
        },
      });
      return;
    }
  }
  next();
}

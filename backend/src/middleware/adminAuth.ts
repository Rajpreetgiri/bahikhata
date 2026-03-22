import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logSecurityEvent } from './securityLogger';

export interface AdminRequest extends Request {
  adminRole?: string;
}

interface AdminTokenPayload {
  role: 'admin';
  sub: 'admin';
  iat?: number;
  exp?: number;
}

export function issueAdminToken(): string {
  const secret = process.env.ADMIN_JWT_SECRET!;
  return jwt.sign({ role: 'admin', sub: 'admin' }, secret, { expiresIn: '8h' });
}

export function adminAuth(req: AdminRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    logSecurityEvent(req, 'INVALID_TOKEN', 'Admin route — no bearer token');
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' } });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminTokenPayload;
    if (payload.role !== 'admin') throw new Error('Not admin role');
    req.adminRole = payload.role;
    next();
  } catch {
    logSecurityEvent(req, 'INVALID_TOKEN', 'Admin route — invalid/expired token');
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired admin token' } });
  }
}

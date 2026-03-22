import { Response } from 'express';

/** Standard success envelope */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data });
}

/** Paginated success envelope */
export function sendPaginated<T>(
  res: Response,
  items: T[],
  meta: { total: number; page: number; pages: number }
): void {
  res.json({ success: true, data: items, meta });
}

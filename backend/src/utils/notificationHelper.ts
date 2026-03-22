/**
 * Creates an in-app notification for a merchant.
 * Non-fatal — notification failures never block the main business operation.
 */

import Notification, { NotificationType } from '../models/Notification';

interface NotificationPayload {
  merchantId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export async function createMerchantNotification(payload: NotificationPayload): Promise<void> {
  try {
    await Notification.create({
      merchantId: payload.merchantId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      metadata: payload.metadata ?? {},
    });
  } catch (err) {
    // Log but never throw — notifications are best-effort
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'WARN',
      event: 'notification_create_failed',
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}

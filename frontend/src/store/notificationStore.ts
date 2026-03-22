import { create } from 'zustand';
import api from '../lib/api';

export type NotificationType =
  | 'reminder_sent'
  | 'bulk_reminder'
  | 'transaction_gave'
  | 'transaction_got'
  | 'invoice_credit'
  | 'invoice_paid'
  | 'invoice_settled'
  | 'invoice_partial'
  | 'admin_broadcast';

export interface AppNotification {
  _id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  // Call after events that create notifications to refresh count
  refresh: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<{ notifications: AppNotification[]; unreadCount: number }>(
        '/api/notifications'
      );
      set({ notifications: res.data.notifications, unreadCount: res.data.unreadCount });
    } finally {
      set({ isLoading: false });
    }
  },

  refresh: async () => {
    // Lightweight refresh — only updates count + latest entries, no loading spinner
    try {
      const res = await api.get<{ notifications: AppNotification[]; unreadCount: number }>(
        '/api/notifications'
      );
      set({ notifications: res.data.notifications, unreadCount: res.data.unreadCount });
    } catch {
      // Silent — refresh failures are non-critical
    }
  },

  markRead: async (id) => {
    await api.post(`/api/notifications/${id}/read`);
    set({
      notifications: get().notifications.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
      unreadCount: Math.max(0, get().unreadCount - 1),
    });
  },

  markAllRead: async () => {
    await api.post('/api/notifications/read-all');
    set({
      notifications: get().notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    });
  },
}));

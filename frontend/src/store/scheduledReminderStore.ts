import { create } from 'zustand';
import { ScheduledReminder } from '../types';
import api from '../lib/api';

interface ScheduledReminderState {
  rules: ScheduledReminder[];
  isLoading: boolean;
  loadRules: () => Promise<void>;
  addRule: (data: { offsetDays: number; channels: string[] }) => Promise<ScheduledReminder>;
  toggleRule: (id: string, isEnabled: boolean) => Promise<void>;
  updateChannels: (id: string, channels: string[]) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
}

export const useScheduledReminderStore = create<ScheduledReminderState>((set, get) => ({
  rules: [],
  isLoading: false,

  loadRules: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<ScheduledReminder[]>('/api/scheduled-reminders');
      set({ rules: res.data });
    } finally {
      set({ isLoading: false });
    }
  },

  addRule: async (data) => {
    const res = await api.post<ScheduledReminder>('/api/scheduled-reminders', data);
    set((s) => ({ rules: [...s.rules, res.data].sort((a, b) => a.offsetDays - b.offsetDays) }));
    return res.data;
  },

  toggleRule: async (id, isEnabled) => {
    const res = await api.patch<ScheduledReminder>(`/api/scheduled-reminders/${id}`, { isEnabled });
    set((s) => ({ rules: s.rules.map((r) => (r._id === id ? res.data : r)) }));
  },

  updateChannels: async (id, channels) => {
    const res = await api.patch<ScheduledReminder>(`/api/scheduled-reminders/${id}`, { channels });
    set((s) => ({ rules: s.rules.map((r) => (r._id === id ? res.data : r)) }));
  },

  deleteRule: async (id) => {
    await api.delete(`/api/scheduled-reminders/${id}`);
    set((s) => ({ rules: s.rules.filter((r) => r._id !== id) }));
  },
}));

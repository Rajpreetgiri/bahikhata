import { create } from 'zustand';
import { CashEntry, CashbookSummary } from '../types';
import api from '../lib/api';

interface CashbookState {
  entries: CashEntry[];
  summary: CashbookSummary | null;
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  loadEntries: (params?: { dateFrom?: string; dateTo?: string; type?: string; reset?: boolean }) => Promise<void>;
  loadSummary: (params?: { dateFrom?: string; dateTo?: string }) => Promise<void>;
  addEntry: (data: { type: 'in' | 'out'; amount: number; note?: string; date: string }) => Promise<CashEntry>;
  updateEntry: (id: string, data: Partial<{ type: 'in' | 'out'; amount: number; note: string; date: string }>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

export const useCashbookStore = create<CashbookState>((set, get) => ({
  entries: [],
  summary: null,
  isLoading: false,
  hasMore: false,
  page: 1,

  loadEntries: async (params = {}) => {
    const { reset = true } = params;
    const page = reset ? 1 : get().page + 1;
    set({ isLoading: true });
    try {
      const q = new URLSearchParams({ page: String(page), limit: '30' });
      if (params.dateFrom) q.set('dateFrom', params.dateFrom);
      if (params.dateTo) q.set('dateTo', params.dateTo);
      if (params.type) q.set('type', params.type);

      // sendSuccess({ data, meta }) → axios interceptor unwraps to { data: CashEntry[], meta: {...} }
      const res = await api.get<{ data: CashEntry[]; meta: { total: number; page: number; pages: number } }>(
        `/api/cashbook?${q}`
      );
      const { data, meta } = res.data;
      const pages = meta?.pages ?? 1;
      const entries = Array.isArray(data) ? data : [];
      set((s) => ({
        entries: reset ? entries : [...s.entries, ...entries],
        hasMore: page < pages,
        page,
      }));
    } finally {
      set({ isLoading: false });
    }
  },

  loadSummary: async (params = {}) => {
    const q = new URLSearchParams();
    if (params.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params.dateTo) q.set('dateTo', params.dateTo);
    const res = await api.get<CashbookSummary>(`/api/cashbook/summary?${q}`);
    set({ summary: res.data });
  },

  addEntry: async (data) => {
    const res = await api.post<CashEntry>('/api/cashbook', data);
    set((s) => ({ entries: [res.data, ...s.entries] }));
    return res.data;
  },

  updateEntry: async (id, data) => {
    const res = await api.put<CashEntry>(`/api/cashbook/${id}`, data);
    set((s) => ({ entries: s.entries.map((e) => (e._id === id ? res.data : e)) }));
  },

  deleteEntry: async (id) => {
    await api.delete(`/api/cashbook/${id}`);
    set((s) => ({ entries: s.entries.filter((e) => e._id !== id) }));
  },
}));

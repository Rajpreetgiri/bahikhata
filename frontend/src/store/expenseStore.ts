import { create } from 'zustand';
import { Expense } from '../types';
import api from '../lib/api';

interface ExpenseMeta {
  total: number;
  page: number;
  pages: number;
}

interface ExpenseFilters {
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}

interface ExpenseSummaryCategory {
  _id: string;
  total: number;
  count: number;
}

interface ExpenseSummary {
  categories: ExpenseSummaryCategory[];
  grandTotal: number;
  dateFrom: string;
  dateTo: string;
}

interface ExpenseState {
  expenses: Expense[];
  meta: ExpenseMeta;
  summary: ExpenseSummary | null;
  isLoading: boolean;

  loadExpenses: (filters?: ExpenseFilters) => Promise<void>;
  loadSummary: (dateFrom?: string, dateTo?: string) => Promise<void>;
  addExpense: (data: {
    amount: number;
    category: string;
    note?: string;
    paymentMethod?: string;
    date: string;
  }) => Promise<Expense>;
  updateExpense: (
    id: string,
    data: { amount?: number; category?: string; note?: string; paymentMethod?: string; date?: string }
  ) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  meta: { total: 0, page: 1, pages: 1 },
  summary: null,
  isLoading: false,

  loadExpenses: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      const page = filters.page ?? 1;
      params.set('page', String(page));
      params.set('limit', '30');

      const res = await api.get<{ data: Expense[]; meta: ExpenseMeta }>(`/api/expenses?${params}`);
      // Load More: append to existing list; fresh load: replace
      if (page > 1) {
        set((s) => ({ expenses: [...s.expenses, ...res.data.data], meta: res.data.meta }));
      } else {
        set({ expenses: res.data.data, meta: res.data.meta });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  loadSummary: async (dateFrom, dateTo) => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const res = await api.get<ExpenseSummary>(`/api/expenses/summary?${params}`);
    set({ summary: res.data });
  },

  addExpense: async (data) => {
    const res = await api.post<Expense>('/api/expenses', data);
    set({ expenses: [res.data, ...get().expenses] });
    return res.data;
  },

  updateExpense: async (id, data) => {
    const res = await api.put<Expense>(`/api/expenses/${id}`, data);
    set({ expenses: get().expenses.map((e) => (e._id === id ? res.data : e)) });
  },

  deleteExpense: async (id) => {
    await api.delete(`/api/expenses/${id}`);
    set({ expenses: get().expenses.filter((e) => e._id !== id) });
  },
}));

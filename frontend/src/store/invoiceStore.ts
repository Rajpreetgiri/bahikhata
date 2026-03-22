import { create } from 'zustand';
import { Invoice, InvoicePaymentMode, InvoiceStatus } from '../types';
import api from '../lib/api';
import { useCustomerStore } from './customerStore';
import { useNotificationStore } from './notificationStore';

interface CreateInvoicePayload {
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  gstPercent?: number;
  dueDate?: string;
  note?: string;
  paymentMode?: InvoicePaymentMode;
}

export interface InvoiceFilters {
  status?: InvoiceStatus;
  customerId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}

interface InvoiceMeta {
  total: number;
  page: number;
  pages: number;
}

interface InvoiceState {
  invoices: Invoice[];
  meta: InvoiceMeta;
  isLoading: boolean;
  loadInvoices: (filters?: InvoiceFilters) => Promise<void>;
  createInvoice: (payload: CreateInvoicePayload) => Promise<Invoice>;
  markAsPaid: (id: string) => Promise<void>;
  partialPay: (id: string, amount: number) => Promise<Invoice>;
  cancelInvoice: (id: string) => Promise<void>;
  returnInvoice: (id: string) => Promise<Invoice>;
  setInvoices: (invoices: Invoice[]) => void;
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  invoices: [],
  meta: { total: 0, page: 1, pages: 1 },
  isLoading: false,

  loadInvoices: async (filters) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.customerId) params.set('customerId', filters.customerId);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      const page = filters?.page ?? 1;
      params.set('page', String(page));
      const res = await api.get<{ data: Invoice[]; meta: InvoiceMeta }>(`/api/invoices?${params.toString()}`);
      // Load More: append; fresh filter/tab change: replace
      if (page > 1) {
        set((s) => ({ invoices: [...s.invoices, ...res.data.data], meta: res.data.meta }));
      } else {
        set({ invoices: res.data.data, meta: res.data.meta });
      }
    } catch (err) {
      console.error('[invoiceStore] loadInvoices failed:', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  createInvoice: async (payload) => {
    const res = await api.post<Invoice>('/api/invoices', payload);
    set({ invoices: [res.data, ...get().invoices] });
    useCustomerStore.getState().loadCustomers();
    useNotificationStore.getState().refresh();
    return res.data;
  },

  markAsPaid: async (id) => {
    const res = await api.patch<Invoice>(`/api/invoices/${id}/mark-paid`);
    set({ invoices: get().invoices.map((inv) => (inv._id === id ? res.data : inv)) });
    await useCustomerStore.getState().loadCustomers();
    useNotificationStore.getState().refresh();
  },

  partialPay: async (id, amount) => {
    const res = await api.patch<Invoice>(`/api/invoices/${id}/partial-pay`, { amount });
    set({ invoices: get().invoices.map((inv) => (inv._id === id ? res.data : inv)) });
    await useCustomerStore.getState().loadCustomers();
    useNotificationStore.getState().refresh();
    return res.data;
  },

  cancelInvoice: async (id) => {
    const res = await api.patch<Invoice>(`/api/invoices/${id}/cancel`);
    set({ invoices: get().invoices.map((inv) => (inv._id === id ? res.data : inv)) });
    await useCustomerStore.getState().loadCustomers();
  },

  returnInvoice: async (id) => {
    const res = await api.patch<Invoice>(`/api/invoices/${id}/return`);
    set({ invoices: get().invoices.map((inv) => (inv._id === id ? res.data : inv)) });
    await useCustomerStore.getState().loadCustomers();
    return res.data;
  },

  setInvoices: (invoices) => set({ invoices }),
}));

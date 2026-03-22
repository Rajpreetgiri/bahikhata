import { create } from 'zustand';
import { Customer } from '../types';
import api from '../lib/api';

interface CustomerState {
  customers: Customer[];
  currentCustomer: Customer | null;
  isLoading: boolean;
  loadCustomers: () => Promise<void>;
  addCustomer: (data: { name: string; phone?: string; email?: string }) => Promise<Customer>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  setCurrentCustomer: (customer: Customer | null) => void;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  currentCustomer: null,
  isLoading: false,

  loadCustomers: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<Customer[]>('/api/customers');
      set({ customers: res.data });
    } catch (err) {
      console.error('[customerStore] loadCustomers failed:', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  addCustomer: async (data) => {
    const res = await api.post<Customer>('/api/customers', data);
    set({ customers: [res.data, ...get().customers] });
    return res.data;
  },

  updateCustomer: async (id, data) => {
    const res = await api.put<Customer>(`/api/customers/${id}`, data);
    set({
      customers: get().customers.map((c) => (c._id === id ? res.data : c)),
      currentCustomer: get().currentCustomer?._id === id ? res.data : get().currentCustomer,
    });
  },

  deleteCustomer: async (id) => {
    await api.delete(`/api/customers/${id}`);
    set({ customers: get().customers.filter((c) => c._id !== id) });
  },

  setCurrentCustomer: (customer) => set({ currentCustomer: customer }),
}));

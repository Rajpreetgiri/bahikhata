import { create } from 'zustand';
import { Supplier } from '../types';
import api from '../lib/api';

interface SupplierState {
  suppliers: Supplier[];
  currentSupplier: Supplier | null;
  isLoading: boolean;
  loadSuppliers: () => Promise<void>;
  addSupplier: (data: { name: string; phone?: string; email?: string; companyName?: string }) => Promise<Supplier>;
  updateSupplier: (id: string, data: Partial<Pick<Supplier, 'name' | 'phone' | 'email' | 'companyName'>>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  setCurrentSupplier: (supplier: Supplier | null) => void;
}

export const useSupplierStore = create<SupplierState>((set, get) => ({
  suppliers: [],
  currentSupplier: null,
  isLoading: false,

  loadSuppliers: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<Supplier[]>('/api/suppliers');
      set({ suppliers: res.data });
    } finally {
      set({ isLoading: false });
    }
  },

  addSupplier: async (data) => {
    const res = await api.post<Supplier>('/api/suppliers', data);
    set({ suppliers: [res.data, ...get().suppliers] });
    return res.data;
  },

  updateSupplier: async (id, data) => {
    const res = await api.put<Supplier>(`/api/suppliers/${id}`, data);
    set({
      suppliers: get().suppliers.map((s) => (s._id === id ? res.data : s)),
      currentSupplier: get().currentSupplier?._id === id ? res.data : get().currentSupplier,
    });
  },

  deleteSupplier: async (id) => {
    await api.delete(`/api/suppliers/${id}`);
    set({ suppliers: get().suppliers.filter((s) => s._id !== id) });
  },

  setCurrentSupplier: (supplier) => set({ currentSupplier: supplier }),
}));

import { create } from 'zustand';
import { Product } from '../types';
import api from '../lib/api';

interface InventoryState {
  products: Product[];
  lowStockProducts: Product[];
  isLoading: boolean;
  loadProducts: () => Promise<void>;
  loadLowStock: () => Promise<void>;
  addProduct: (data: Partial<Product>) => Promise<Product>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  adjustStock: (id: string, adjustment: number, note?: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  lowStockProducts: [],
  isLoading: false,

  loadProducts: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<Product[]>('/api/products');
      set({ products: res.data });
    } finally {
      set({ isLoading: false });
    }
  },

  loadLowStock: async () => {
    const res = await api.get<Product[]>('/api/products/low-stock');
    set({ lowStockProducts: res.data });
  },

  addProduct: async (data) => {
    const res = await api.post<Product>('/api/products', data);
    set({ products: [...get().products, res.data].sort((a, b) => a.name.localeCompare(b.name)) });
    return res.data;
  },

  updateProduct: async (id, data) => {
    const res = await api.put<Product>(`/api/products/${id}`, data);
    set({ products: get().products.map((p) => (p._id === id ? res.data : p)) });
  },

  adjustStock: async (id, adjustment, note) => {
    const res = await api.patch<Product>(`/api/products/${id}/stock`, { adjustment, note });
    set({ products: get().products.map((p) => (p._id === id ? res.data : p)) });
  },

  deleteProduct: async (id) => {
    await api.delete(`/api/products/${id}`);
    set({ products: get().products.filter((p) => p._id !== id) });
  },
}));

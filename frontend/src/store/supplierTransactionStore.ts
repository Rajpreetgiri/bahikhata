import { create } from 'zustand';
import { SupplierTransaction } from '../types';
import api from '../lib/api';
import { useSupplierStore } from './supplierStore';

interface SupplierTransactionState {
  transactions: SupplierTransaction[];
  isLoading: boolean;
  addTransaction: (data: {
    supplierId: string;
    type: 'bought' | 'paid';
    amount: number;
    note?: string;
  }) => Promise<SupplierTransaction>;
  deleteTransaction: (id: string) => Promise<void>;
  setTransactions: (txs: SupplierTransaction[]) => void;
}

export const useSupplierTransactionStore = create<SupplierTransactionState>((set, get) => ({
  transactions: [],
  isLoading: false,

  addTransaction: async (data) => {
    const res = await api.post<SupplierTransaction>('/api/supplier-transactions', data);
    set({ transactions: [res.data, ...get().transactions] });
    useSupplierStore.getState().loadSuppliers();
    return res.data;
  },

  deleteTransaction: async (id) => {
    await api.delete(`/api/supplier-transactions/${id}`);
    set({ transactions: get().transactions.filter((t) => t._id !== id) });
    useSupplierStore.getState().loadSuppliers();
  },

  setTransactions: (txs) => set({ transactions: txs }),
}));

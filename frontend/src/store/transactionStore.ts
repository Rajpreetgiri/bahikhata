import { create } from 'zustand';
import { Transaction } from '../types';
import api from '../lib/api';
import { useCustomerStore } from './customerStore';
import { useNotificationStore } from './notificationStore';

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  addTransaction: (data: {
    customerId: string;
    type: 'gave' | 'got';
    amount: number;
    note?: string;
    paymentMethod?: string;
    photoUrl?: string;
    dueDate?: string;
  }) => Promise<Transaction>;
  deleteTransaction: (id: string, customerId: string) => Promise<void>;
  setTransactions: (txs: Transaction[]) => void;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  isLoading: false,

  addTransaction: async (data) => {
    const res = await api.post<Transaction>('/api/transactions', data);
    set({ transactions: [res.data, ...get().transactions] });
    // Refresh customers + notification bell
    useCustomerStore.getState().loadCustomers();
    useNotificationStore.getState().refresh();
    return res.data;
  },

  deleteTransaction: async (id, _customerId) => {
    await api.delete(`/api/transactions/${id}`);
    set({ transactions: get().transactions.filter((t) => t._id !== id) });
    useCustomerStore.getState().loadCustomers();
  },

  setTransactions: (txs) => set({ transactions: txs }),
}));

import { create } from 'zustand';
import { WalletInfo, WalletTransaction, SMSPlan } from '../types';
import api from '../lib/api';

interface WalletState {
  wallet: WalletInfo | null;
  plans: SMSPlan[];
  history: WalletTransaction[];
  isLoading: boolean;
  loadWallet: () => Promise<void>;
  loadPlans: () => Promise<void>;
  loadHistory: () => Promise<void>;
  createTopUpOrder: (amount: number) => Promise<{ orderId: string; amount: number; keyId: string }>;
  verifyTopUp: (params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    amount: number;
  }) => Promise<number>; // returns new balance
  createPackOrder: (plan: string) => Promise<{ orderId: string; amount: number; label: string; keyId: string }>;
  verifyPackPurchase: (params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan: string;
  }) => Promise<void>;
}

export const useWalletStore = create<WalletState>((set) => ({
  wallet: null,
  plans: [],
  history: [],
  isLoading: false,

  loadWallet: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<WalletInfo>('/api/wallet');
      set({ wallet: res.data });
    } finally {
      set({ isLoading: false });
    }
  },

  loadPlans: async () => {
    const res = await api.get<SMSPlan[]>('/api/wallet/plans');
    set({ plans: res.data });
  },

  loadHistory: async () => {
    const res = await api.get<{ data: WalletTransaction[] }>('/api/wallet/history');
    set({ history: res.data.data });
  },

  createTopUpOrder: async (amount) => {
    const res = await api.post<{ orderId: string; amount: number; keyId: string }>(
      '/api/wallet/create-order',
      { amount }
    );
    return res.data;
  },

  verifyTopUp: async (params) => {
    const res = await api.post<{ balance: number }>('/api/wallet/verify-payment', params);
    set((s) => ({ wallet: s.wallet ? { ...s.wallet, balance: res.data.balance } : null }));
    return res.data.balance;
  },

  createPackOrder: async (plan) => {
    const res = await api.post<{ orderId: string; amount: number; label: string; keyId: string }>(
      '/api/wallet/buy-pack/create-order',
      { plan }
    );
    return res.data;
  },

  verifyPackPurchase: async (params) => {
    await api.post('/api/wallet/buy-pack/verify', params);
    // Reload wallet to get updated pack info
    const res = await api.get<WalletInfo>('/api/wallet');
    set({ wallet: res.data });
  },
}));

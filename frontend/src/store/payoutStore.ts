import { create } from 'zustand';
import { PayoutAccount, RouteTransfer } from '../types';
import api from '../lib/api';

interface ConnectPayload {
  legalBusinessName: string;
  pan: string;
  city: string;
  state: string;
  postalCode: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  upiId?: string;
}

interface BankPayload {
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName?: string;
}

interface PayoutState {
  account: PayoutAccount | null;
  transfers: RouteTransfer[];
  isLoading: boolean;
  transfersLoading: boolean;
  loadAccount: () => Promise<void>;
  connectAccount: (data: ConnectPayload) => Promise<void>;
  updateUpi: (upiId: string) => Promise<void>;
  updateBank: (data: BankPayload) => Promise<void>;
  updateFee: (platformFeePercent: number) => Promise<void>;
  syncStatus: () => Promise<void>;
  loadTransfers: () => Promise<void>;
  disconnectAccount: () => Promise<void>;
}

export const usePayoutStore = create<PayoutState>((set) => ({
  account: null,
  transfers: [],
  isLoading: false,
  transfersLoading: false,

  loadAccount: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<PayoutAccount>('/api/payout');
      set({ account: res.data });
    } finally {
      set({ isLoading: false });
    }
  },

  connectAccount: async (data) => {
    const res = await api.post<PayoutAccount>('/api/payout/connect', data);
    set({ account: res.data });
  },

  updateUpi: async (upiId) => {
    const res = await api.patch<PayoutAccount>('/api/payout/upi', { upiId });
    set({ account: res.data });
  },

  updateBank: async (data) => {
    const res = await api.patch<PayoutAccount>('/api/payout/bank', data);
    set({ account: res.data });
  },

  updateFee: async (platformFeePercent) => {
    const res = await api.patch<PayoutAccount>('/api/payout/fee', { platformFeePercent });
    set({ account: res.data });
  },

  syncStatus: async () => {
    const res = await api.post<PayoutAccount>('/api/payout/sync-status');
    set({ account: res.data });
  },

  loadTransfers: async () => {
    set({ transfersLoading: true });
    try {
      const res = await api.get<RouteTransfer[]>('/api/payout/transfers');
      set({ transfers: res.data });
    } finally {
      set({ transfersLoading: false });
    }
  },

  disconnectAccount: async () => {
    await api.delete('/api/payout/disconnect');
    set({ account: { razorpayAccountStatus: 'not_connected', platformFeePercent: 0, totalRouteTransfers: 0, totalAmountRouted: 0 } });
  },
}));

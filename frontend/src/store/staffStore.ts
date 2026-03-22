import { create } from 'zustand';
import { StaffMember } from '../types';
import api from '../lib/api';

interface StaffState {
  members: StaffMember[];
  isLoading: boolean;
  loadStaff: () => Promise<void>;
  inviteStaff: (email: string, role: 'admin' | 'viewer') => Promise<void>;
  changeRole: (staffId: string, role: 'admin' | 'viewer') => Promise<void>;
  removeStaff: (staffId: string) => Promise<void>;
}

export const useStaffStore = create<StaffState>((set) => ({
  members: [],
  isLoading: false,

  loadStaff: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<StaffMember[]>('/api/staff');
      set({ members: Array.isArray(res.data) ? res.data : [] });
    } finally {
      set({ isLoading: false });
    }
  },

  inviteStaff: async (email, role) => {
    await api.post('/api/staff/invite', { email, role });
  },

  changeRole: async (staffId, role) => {
    await api.patch(`/api/staff/${staffId}/role`, { role });
    set((s) => ({
      members: s.members.map((m) => (m.id === staffId ? { ...m, role } : m)),
    }));
  },

  removeStaff: async (staffId) => {
    await api.delete(`/api/staff/${staffId}`);
    set((s) => ({ members: s.members.filter((m) => m.id !== staffId) }));
  },
}));

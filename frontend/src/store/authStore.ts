import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import api from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
  setToken: (token: string) => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (token, refreshToken, user) => {
        set({ token, refreshToken, user, isAuthenticated: true });
      },

      logout: async () => {
        const { refreshToken } = get();
        try {
          if (refreshToken) await api.post('/api/auth/logout', { refreshToken });
        } catch {
          // ignore errors on logout
        }
        set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
      },

      setToken: (token) => set({ token }),

      updateProfile: async (data) => {
        const res = await api.put('/api/auth/profile', data);
        set({ user: res.data });
      },
    }),
    {
      name: 'udhaari-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

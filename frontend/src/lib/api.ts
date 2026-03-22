import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000',
  timeout: 15_000,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track if a refresh is already in-flight to avoid multiple concurrent refreshes
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(newToken: string) {
  refreshQueue.forEach((resolve) => resolve(newToken));
  refreshQueue = [];
}

// Unwrap { success, data } envelope + handle 401 with auto-refresh
api.interceptors.response.use(
  (res) => {
    if (res.data && typeof res.data === 'object' && 'success' in res.data && 'data' in res.data) {
      res.data = res.data.data;
    }
    return res;
  },
  async (err: AxiosError) => {
    const original = err.config as InternalAxiosRequestConfig & { _retried?: boolean };

    // Auto-refresh on 401, but only once per request and not on auth routes
    if (
      err.response?.status === 401 &&
      !original._retried &&
      original.url !== '/api/auth/refresh' &&
      original.url !== '/api/auth/logout'
    ) {
      const { refreshToken, setToken, logout } = useAuthStore.getState();

      if (!refreshToken) {
        logout();
        return Promise.reject(err);
      }

      original._retried = true;

      if (isRefreshing) {
        // Wait for the ongoing refresh to finish, then retry
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL ?? 'http://localhost:5000'}/api/auth/refresh`,
          { refreshToken }
        );
        const newToken: string = res.data?.data?.token ?? res.data?.token;
        const newRefreshToken: string = res.data?.data?.refreshToken ?? res.data?.refreshToken;

        setToken(newToken);
        // Also update the refresh token in store
        useAuthStore.setState({ refreshToken: newRefreshToken });

        processQueue(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        // Refresh failed — full logout
        refreshQueue = [];
        useAuthStore.getState().logout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // Normalise error message from backend envelope
    if (err.response?.data && typeof err.response.data === 'object') {
      const data = err.response.data as Record<string, unknown>;
      if (data.error && typeof data.error === 'object') {
        const errObj = data.error as Record<string, unknown>;
        if (typeof errObj.message === 'string') {
          (err.response.data as Record<string, unknown>).error = errObj.message;
        }
      }
    }
    return Promise.reject(err);
  }
);

/** Extract user-facing error message from API/axios errors for toasts. */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const ax = err as { response?: { data?: { error?: string | { message?: string } } } };
    const raw = ax.response?.data?.error;
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (raw && typeof raw === 'object' && typeof (raw as { message?: string }).message === 'string')
      return (raw as { message: string }).message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export default api;

import axios from 'axios';
import { useAdminStore } from '../store/adminStore';

const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000',
  timeout: 30_000,
});

// Attach admin JWT on every request
adminApi.interceptors.request.use((config) => {
  const token = useAdminStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Unwrap { success, data } envelope + handle 401 auto-logout
adminApi.interceptors.response.use(
  (res) => {
    if (res.data && typeof res.data === 'object' && 'success' in res.data && 'data' in res.data) {
      res.data = res.data.data;
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      useAdminStore.getState().logout();
      window.location.href = '/admin/login';
    }
    if (err.response?.data?.error?.message) {
      err.response.data.error = err.response.data.error.message;
    }
    return Promise.reject(err);
  }
);

/** Extract error message from admin API errors. */
export function getAdminApiError(err: unknown, fallback: string): string {
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

export default adminApi;

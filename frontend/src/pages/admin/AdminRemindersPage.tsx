import { useEffect, useState, useCallback } from 'react';
import adminApi, { getAdminApiError } from '../../lib/adminApi';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Reminder {
  _id: string;
  channel: string;
  status: string;
  message?: string;
  createdAt: string;
  merchantId?: { businessName?: string };
  customerId?: { name?: string; phone?: string };
}

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-green-900/40 text-green-400',
  pending: 'bg-yellow-900/40 text-yellow-400',
  failed: 'bg-red-900/40 text-red-400',
};

export default function AdminRemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.get(`/api/admin/reminders?page=${page}&limit=${LIMIT}`);
      setReminders(res.data.reminders);
      setTotal(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      setError(getAdminApiError(err, 'Failed to load reminders'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Reminders</h1>
        <p className="text-gray-400 text-sm">{total} reminders sent across all merchants</p>
      </div>

      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Merchant</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Customer</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Channel</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Message</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Sent At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : reminders.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500">No reminders found</td></tr>
              ) : (
                reminders.map((r) => (
                  <tr key={r._id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-300 text-xs">{r.merchantId?.businessName || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300">{r.customerId?.name || '—'}</div>
                      <div className="text-gray-500 text-xs">{r.customerId?.phone ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 capitalize">{r.channel}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-700 text-gray-400'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{r.message ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(r.createdAt).toLocaleString('en-IN')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-400">Page {page} of {totalPages} · {total} reminders</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

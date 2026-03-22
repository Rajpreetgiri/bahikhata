import { useEffect, useState, useCallback } from 'react';
import adminApi, { getAdminApiError } from '../../lib/adminApi';
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react';

interface WalletRow {
  _id: string;
  balance: number;
  updatedAt: string;
  merchant: { _id: string; businessName?: string; email: string };
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function AdminWalletsPage() {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
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
      const res = await adminApi.get(`/api/admin/wallets?page=${page}&limit=${LIMIT}`);
      setWallets(res.data.wallets);
      setTotalBalance(res.data.totalBalance);
      setTotal(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      setError(getAdminApiError(err, 'Failed to load wallets'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Wallets</h1>
          <p className="text-gray-400 text-sm">{total} merchant wallets</p>
        </div>
        <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl px-5 py-3 flex items-center gap-3">
          <Wallet className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-xs text-emerald-400/70">Total Platform Balance</p>
            <p className="text-lg font-bold text-emerald-400">{fmt(totalBalance)}</p>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Merchant</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Balance</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    {Array.from({ length: 3 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : wallets.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-12 text-gray-500">No wallets found</td></tr>
              ) : (
                wallets.map((w) => (
                  <tr key={w._id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{w.merchant.businessName || '—'}</div>
                      <div className="text-xs text-gray-500">{w.merchant.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${w.balance > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>{fmt(w.balance)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(w.updatedAt).toLocaleString('en-IN')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-400">Page {page} of {totalPages}</p>
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

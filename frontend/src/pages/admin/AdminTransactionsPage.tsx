import { useEffect, useState, useCallback } from 'react';
import adminApi, { getAdminApiError } from '../../lib/adminApi';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Tx {
  _id: string;
  type: 'gave' | 'got';
  amount: number;
  note?: string;
  paymentMethod?: string;
  createdAt: string;
  merchantId?: { businessName?: string; email?: string };
  customerId?: { name?: string; phone?: string };
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (typeFilter) params.set('type', typeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await adminApi.get(`/api/admin/transactions?${params}`);
      setTransactions(res.data.transactions);
      setTotal(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      setError(getAdminApiError(err, 'Failed to load transactions'));
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  function applyFilters() {
    setPage(1);
    load();
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">All Transactions</h1>
        <p className="text-gray-400 text-sm">{total} transactions across all merchants</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Types</option>
          <option value="gave">Gave (Udhari)</option>
          <option value="got">Got (Payment)</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
        />
        <button onClick={applyFilters} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">Apply</button>
        <button onClick={() => { setTypeFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-3 py-2 rounded-lg transition-colors">Reset</button>
      </div>

      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Merchant</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Customer</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Method</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">No transactions found</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx._id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-white text-xs font-medium">{tx.merchantId?.businessName || '—'}</div>
                      <div className="text-gray-500 text-xs">{tx.merchantId?.email ?? ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300">{tx.customerId?.name || '—'}</div>
                      <div className="text-gray-500 text-xs">{tx.customerId?.phone ?? ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tx.type === 'gave' ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'}`}>
                        {tx.type === 'gave' ? 'Gave' : 'Got'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${tx.type === 'gave' ? 'text-red-400' : 'text-green-400'}`}>{fmt(tx.amount)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs capitalize">{tx.paymentMethod?.replace('_', ' ') ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(tx.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{tx.note ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-400">Page {page} of {totalPages} · {total} transactions</p>
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

import { useEffect, useState, useCallback } from 'react';
import adminApi, { getAdminApiError } from '../../lib/adminApi';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Customer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  totalOutstanding: number;
  isDeleted: boolean;
  createdAt: string;
  merchantId?: { businessName?: string; email?: string };
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
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
      if (search) params.set('search', search);
      const res = await adminApi.get(`/api/admin/customers?${params}`);
      setCustomers(res.data.customers);
      setTotal(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      setError(getAdminApiError(err, 'Failed to load customers'));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">All Customers</h1>
          <p className="text-gray-400 text-sm">{total} customers across all merchants</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or phone…"
              className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-64"
            />
          </div>
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">Search</button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="text-gray-400 hover:text-white text-sm px-3 py-2 rounded-lg bg-gray-800">Clear</button>
          )}
        </form>
      </div>

      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Customer</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Merchant</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Outstanding</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    {Array.from({ length: 4 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-500">No customers found</td></tr>
              ) : (
                customers.map((c) => (
                  <tr key={c._id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.phone ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300">{c.merchantId?.businessName || '—'}</div>
                      <div className="text-xs text-gray-500">{c.merchantId?.email ?? ''}</div>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${c.totalOutstanding > 0 ? 'text-red-400' : c.totalOutstanding < 0 ? 'text-green-400' : 'text-gray-400'}`}>
                      {fmt(c.totalOutstanding)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-400">Page {page} of {totalPages} · {total} customers</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

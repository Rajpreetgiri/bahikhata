import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi, { getAdminApiError } from '../../lib/adminApi';
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface Merchant {
  _id: string;
  email: string;
  businessName: string;
  ownerName: string;
  phone?: string;
  businessCategory?: string;
  isOnboarded: boolean;
  createdAt: string;
  customerCount: number;
  supplierCount: number;
  txCount: number;
  txVolume: number;
  walletBalance: number;
}

function fmt(n: number) {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

export default function AdminMerchantsPage() {
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
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
      const res = await adminApi.get(`/api/admin/merchants?${params}`);
      setMerchants(res.data.merchants);
      setTotal(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      setError(getAdminApiError(err, 'Failed to load merchants'));
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
          <h1 className="text-xl font-bold text-white">Merchants</h1>
          <p className="text-gray-400 text-sm">{total} total shopkeepers registered</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or email…"
              className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-64"
            />
          </div>
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            Search
          </button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="text-gray-400 hover:text-white text-sm px-3 py-2 rounded-lg bg-gray-800">
              Clear
            </button>
          )}
        </form>
      </div>

      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Business</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Email</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Customers</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Suppliers</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Transactions</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Volume</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Wallet</th>
                <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : merchants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-500">No merchants found</td>
                </tr>
              ) : (
                merchants.map((m) => (
                  <tr key={m._id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{m.businessName || '(not set)'}</div>
                      <div className="text-xs text-gray-500">{m.ownerName || '—'} · {m.businessCategory ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{m.email}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{m.customerCount}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{m.supplierCount}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{m.txCount}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(m.txVolume)}</td>
                    <td className="px-4 py-3 text-right text-emerald-400">{fmt(m.walletBalance)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.isOnboarded ? 'bg-green-900/40 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                        {m.isOnboarded ? 'Active' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/merchants/${m._id}`)}
                        className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-400">
              Page {page} of {totalPages} · {total} merchants
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

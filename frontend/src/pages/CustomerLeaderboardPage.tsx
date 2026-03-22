import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Star, ChevronRight, TrendingUp, Hash } from 'lucide-react';
import api from '../lib/api';
import PageHeader from '../components/layout/PageHeader';
import Spinner from '../components/ui/Spinner';

interface LeaderboardEntry {
  customerId: string;
  name: string;
  phone?: string;
  totalOutstanding: number;
  totalInvoiced: number;
  invoiceCount: number;
  paidCount: number;
  lastInvoiceAt: string;
  isGoodCustomer: boolean;
}

type SortBy = 'totalInvoiced' | 'invoiceCount';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function CustomerLeaderboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('totalInvoiced');

  const load = async (s: SortBy) => {
    setIsLoading(true);
    try {
      const res = await api.get<LeaderboardEntry[]>(`/api/customers/leaderboard?sortBy=${s}&limit=50`);
      setData(res.data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(sortBy); }, [sortBy]);

  const goodCustomers = data.filter((d) => d.isGoodCustomer);

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Customer Leaderboard" />

      {/* Sort tabs */}
      <div className="bg-white px-4 pt-3 pb-3 border-b border-gray-100">
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('totalInvoiced')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              sortBy === 'totalInvoiced'
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
          >
            <TrendingUp size={13} />
            Total Invoiced
          </button>
          <button
            onClick={() => setSortBy('invoiceCount')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              sortBy === 'invoiceCount'
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
          >
            <Hash size={13} />
            Invoice Count
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">

        {/* Good Customers banner */}
        {!isLoading && goodCustomers.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star size={15} className="text-yellow-500 fill-yellow-500" />
              <p className="text-sm font-bold text-yellow-800">Good Customers ({goodCustomers.length})</p>
            </div>
            <p className="text-xs text-yellow-600 mb-3">10+ invoices, 100% paid — reliable partners</p>
            <div className="flex flex-wrap gap-2">
              {goodCustomers.map((c) => (
                <button
                  key={c.customerId}
                  onClick={() => navigate(`/customers/${c.customerId}`)}
                  className="flex items-center gap-1.5 bg-white border border-yellow-200 px-3 py-1.5 rounded-full text-xs font-semibold text-yellow-800 hover:bg-yellow-50 transition-colors"
                >
                  <Star size={11} className="text-yellow-500 fill-yellow-500" />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Trophy size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-semibold">No invoice data yet</p>
            <p className="text-sm mt-1">Create invoices to see the leaderboard</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((entry, idx) => (
              <button
                key={entry.customerId}
                onClick={() => navigate(`/customers/${entry.customerId}`)}
                className="w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                {/* Rank */}
                <div className="w-8 flex-shrink-0 text-center">
                  {idx < 3 ? (
                    <span className="text-xl leading-none">{MEDALS[idx]}</span>
                  ) : (
                    <span className="text-sm font-bold text-gray-400">#{idx + 1}</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-gray-800 truncate">{entry.name}</p>
                    {entry.isGoodCustomer && (
                      <Star size={13} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {entry.invoiceCount} invoice{entry.invoiceCount !== 1 ? 's' : ''} · {entry.paidCount} paid
                  </p>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900 text-sm">
                    ₹{entry.totalInvoiced.toLocaleString('en-IN')}
                  </p>
                  {entry.totalOutstanding > 0 && (
                    <p className="text-xs text-red-500">
                      ₹{entry.totalOutstanding.toLocaleString('en-IN')} due
                    </p>
                  )}
                </div>

                <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import adminApi, { getAdminApiError } from '../../lib/adminApi';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Users,
  UserCheck,
  ArrowLeftRight,
  FileText,
  Wallet,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

interface Stats {
  merchants: { total: number; onboarded: number };
  customers: number;
  suppliers: number;
  transactions: number;
  invoices: number;
  volume: { gave: number; got: number; net: number };
  walletBalance: number;
}

interface ChartPoint {
  date: string;
  count?: number;
  type?: string;
  total?: number;
  revenue?: number;
}

function fmt(n: number) {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function fmtNum(n: number) {
  if (n >= 10_00_000) return `${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const DAYS_OPTIONS = [7, 14, 30, 90];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [merchantChart, setMerchantChart] = useState<ChartPoint[]>([]);
  const [txChart, setTxChart] = useState<ChartPoint[]>([]);
  const [revenueChart, setRevenueChart] = useState<ChartPoint[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [statsRes, mchRes, txRes, revRes] = await Promise.all([
        adminApi.get('/api/admin/stats'),
        adminApi.get(`/api/admin/chart/merchants?days=${days}`),
        adminApi.get(`/api/admin/chart/transactions?days=${days}`),
        adminApi.get(`/api/admin/chart/revenue?days=${days}`),
      ]);
      setStats(statsRes.data);
      setMerchantChart(mchRes.data);

      // Pivot tx chart: [{date, gave, got}]
      const txMap: Record<string, { date: string; gave: number; got: number }> = {};
      for (const row of txRes.data as { date: string; type: string; total: number }[]) {
        if (!txMap[row.date]) txMap[row.date] = { date: row.date, gave: 0, got: 0 };
        if (row.type === 'gave') txMap[row.date].gave = row.total;
        else txMap[row.date].got = row.total;
      }
      setTxChart(Object.values(txMap).sort((a, b) => a.date.localeCompare(b.date)));
      setRevenueChart(revRes.data);
    } catch (err) {
      setError(getAdminApiError(err, 'Failed to load dashboard data'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [days]);

  const statCards = stats
    ? [
        { label: 'Total Merchants', value: fmtNum(stats.merchants.total), sub: `${stats.merchants.onboarded} onboarded`, icon: UserCheck, color: 'indigo' },
        { label: 'Total Customers', value: fmtNum(stats.customers), icon: Users, color: 'blue' },
        { label: 'Total Suppliers', value: fmtNum(stats.suppliers), icon: Users, color: 'purple' },
        { label: 'Transactions', value: fmtNum(stats.transactions), icon: ArrowLeftRight, color: 'green' },
        { label: 'Invoices', value: fmtNum(stats.invoices), icon: FileText, color: 'yellow' },
        { label: 'Wallet Balance', value: fmt(stats.walletBalance), icon: Wallet, color: 'emerald' },
        { label: 'Total Udhari Given', value: fmt(stats.volume.gave), icon: TrendingUp, color: 'red' },
        { label: 'Total Collected', value: fmt(stats.volume.got), icon: TrendingUp, color: 'teal' },
      ]
    : [];

  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/20 text-indigo-400',
    blue: 'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    green: 'bg-green-500/20 text-green-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    red: 'bg-red-500/20 text-red-400',
    teal: 'bg-teal-500/20 text-teal-400',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Platform-wide overview</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
            {DAYS_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  days === d ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Stat cards */}
      {loading && !stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-xl font-bold text-white mt-1">{value}</p>
                  {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
                </div>
                <div className={`p-2 rounded-lg ${colorMap[color]}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Merchant registrations */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-sm font-semibold text-white mb-4">New Merchants (last {days}d)</h2>
          {merchantChart.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={merchantChart}>
                <defs>
                  <linearGradient id="cInd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e5e7eb' }}
                  itemStyle={{ color: '#a5b4fc' }}
                />
                <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#cInd)" strokeWidth={2} name="New merchants" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Transaction volume */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-sm font-semibold text-white mb-4">Transaction Volume — last {days}d</h2>
          {txChart.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={txChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => fmt(v)} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e5e7eb' }}
                  formatter={(val: number | undefined) => [fmt(val ?? 0)]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="gave" name="Gave (udhari)" fill="#f87171" radius={[3, 3, 0, 0]} />
                <Bar dataKey="got" name="Got (payment)" fill="#34d399" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Revenue chart — full width */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h2 className="text-sm font-semibold text-white mb-4">Invoice Revenue (paid) — last {days}d</h2>
        {revenueChart.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-600 text-sm">No paid invoices in this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={revenueChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(val: number | undefined) => [fmt(val ?? 0)]}
              />
              <Line type="monotone" dataKey="revenue" stroke="#fbbf24" strokeWidth={2} dot={false} name="Revenue" />
              <Line type="monotone" dataKey="count" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="Invoices" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

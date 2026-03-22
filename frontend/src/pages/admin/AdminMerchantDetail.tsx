import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adminApi, { getAdminApiError } from '../../lib/adminApi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Users, Package, ArrowLeftRight, BarChart2,
  TrendingUp, TrendingDown, AlertTriangle, ShoppingCart,
  IndianRupee, Percent, RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MerchantDetail {
  merchant: {
    _id: string; email: string; businessName: string; ownerName: string;
    phone?: string; businessCategory?: string; businessAddress?: string;
    gstNumber?: string; isOnboarded: boolean; createdAt: string;
  };
  stats: {
    customers: number; suppliers: number; txCount: number;
    txVolume: { gave: number; got: number }; walletBalance: number;
  };
}

interface DeepStats {
  inventory: {
    totalProducts: number; outOfStock: number; lowStock: number;
    stockValue: number; stockCostValue: number; potentialMargin: number;
    topProducts: { name: string; stock: number; unit: string; sellingPrice: number; purchasePrice?: number; stockValue: number }[];
  };
  revenue: {
    thisYear: number; lastYear: number; thisMonth: number; yoyGrowth: number | null;
    monthly: { year: number; month: number; revenue: number; count: number }[];
  };
  profit: {
    cogs: number; grossProfit: number; grossMargin: number;
    expenses: number; netProfit: number; netMargin: number;
  };
  invoices: {
    total: number;
    byStatus: Record<string, { count: number; total: number }>;
  };
  expenses: {
    thisYear: number;
    byCategory: { _id: string; total: number }[];
  };
  outstanding: {
    totalOwed: number; totalAdvances: number; activeCustomers: number; supplierDue: number;
  };
  transactions: { gaveThisYear: number; gotThisYear: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type Tab = 'overview' | 'stats' | 'inventory' | 'customers' | 'suppliers' | 'transactions' | 'products';

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, positive,
}: { label: string; value: string; sub?: string; icon: React.ElementType; positive?: boolean }) {
  return (
    <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 font-medium">{label}</p>
          <p className={`text-lg font-bold mt-1 ${positive === undefined ? 'text-white' : positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {value}
          </p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <div className="p-2 rounded-lg bg-gray-700/50 ml-3">
          <Icon className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminMerchantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<MerchantDetail | null>(null);
  const [deep, setDeep] = useState<DeepStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deepLoading, setDeepLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');

  // Sub-list states
  const [subData, setSubData] = useState<unknown[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subPage, setSubPage] = useState(1);
  const [subTotal, setSubTotal] = useState(0);

  useEffect(() => {
    async function loadMain() {
      try {
        const res = await adminApi.get(`/api/admin/merchants/${id}`);
        setDetail(res.data);
      } catch (err) {
        setError(getAdminApiError(err, 'Failed to load merchant'));
      } finally {
        setLoading(false);
      }
    }
    loadMain();
  }, [id]);

  async function loadDeep() {
    setDeepLoading(true);
    try {
      const res = await adminApi.get(`/api/admin/merchants/${id}/deep-stats`);
      setDeep(res.data);
    } catch {
      // non-blocking
    } finally {
      setDeepLoading(false);
    }
  }

  // Load deep stats when stats/inventory tab is first opened
  useEffect(() => {
    if ((tab === 'stats' || tab === 'inventory') && !deep) {
      loadDeep();
    }
  }, [tab]);

  // Sub-list loading (customers/suppliers/transactions/products)
  useEffect(() => {
    if (!['customers', 'suppliers', 'transactions', 'products'].includes(tab)) return;
    async function loadSub() {
      setSubLoading(true);
      try {
        const endpoint = tab === 'customers' ? 'customers'
          : tab === 'suppliers' ? 'suppliers'
          : tab === 'transactions' ? 'transactions'
          : 'products';
        const res = await adminApi.get(`/api/admin/merchants/${id}/${endpoint}?page=${subPage}&limit=20`);
        setSubData((res.data as Record<string, unknown[]>)[endpoint] ?? []);
        setSubTotal((res.data as { pagination: { total: number } }).pagination.total);
      } catch {
        // ignore
      } finally {
        setSubLoading(false);
      }
    }
    loadSub();
  }, [tab, subPage, id]);

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;
  if (error || !detail) return <div className="p-6 text-red-400 text-sm">{error || 'Not found'}</div>;

  const { merchant, stats } = detail;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: IndianRupee },
    { id: 'stats', label: 'Statistics', icon: BarChart2 },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'customers', label: `Customers (${stats.customers})`, icon: Users },
    { id: 'suppliers', label: `Suppliers (${stats.suppliers})`, icon: ShoppingCart },
    { id: 'transactions', label: `Transactions (${stats.txCount})`, icon: ArrowLeftRight },
    { id: 'products', label: 'Products', icon: Package },
  ];

  // Build chart data for monthly revenue
  const chartData = deep?.revenue.monthly.map((m) => ({
    name: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
    revenue: m.revenue,
    invoices: m.count,
  })) ?? [];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/merchants')}
          className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">{merchant.businessName || merchant.email}</h1>
          <p className="text-gray-400 text-sm">{merchant.email}</p>
        </div>
        <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-medium ${merchant.isOnboarded ? 'bg-green-900/40 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
          {merchant.isOnboarded ? 'Active' : 'Pending Onboarding'}
        </span>
      </div>

      {/* Tab bar — scrollable */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 bg-gray-800/50 rounded-xl p-1 w-max">
          {tabs.map(({ id: tid, label, icon: Icon }) => (
            <button
              key={tid}
              onClick={() => { setTab(tid); setSubPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === tid ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
            <h2 className="text-sm font-semibold text-white">Business Info</h2>
            {[
              ['Owner', merchant.ownerName || '—'],
              ['Phone', merchant.phone || '—'],
              ['Category', merchant.businessCategory || '—'],
              ['Address', merchant.businessAddress || '—'],
              ['GST Number', merchant.gstNumber || '—'],
              ['Joined', new Date(merchant.createdAt).toLocaleDateString('en-IN')],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-400">{k}</span>
                <span className="text-white">{v}</span>
              </div>
            ))}
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
            <h2 className="text-sm font-semibold text-white">Quick Stats</h2>
            {[
              ['Customers', String(stats.customers)],
              ['Suppliers', String(stats.suppliers)],
              ['Total Transactions', String(stats.txCount)],
              ['Total Udhari Given', INR(stats.txVolume.gave)],
              ['Total Collected', INR(stats.txVolume.got)],
              ['Net Udhari', INR(stats.txVolume.gave - stats.txVolume.got)],
              ['Wallet Balance', INR(stats.walletBalance)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-400">{k}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STATISTICS TAB ── */}
      {tab === 'stats' && (
        <div className="space-y-6">
          {deepLoading && !deep ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse h-24" />
              ))}
            </div>
          ) : !deep ? (
            <div className="text-gray-500 text-sm p-4">Failed to load statistics.</div>
          ) : (
            <>
              {/* Revenue cards */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white">Revenue</h2>
                  <button onClick={loadDeep} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
                    <RefreshCw className={`w-3 h-3 ${deepLoading ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Revenue This Year" value={INR(deep.revenue.thisYear)} icon={TrendingUp} positive={true} />
                  <StatCard label="Revenue This Month" value={INR(deep.revenue.thisMonth)} icon={IndianRupee} />
                  <StatCard label="Revenue Last Year" value={INR(deep.revenue.lastYear)} icon={TrendingDown} />
                  <StatCard
                    label="YoY Growth"
                    value={deep.revenue.yoyGrowth !== null ? `${deep.revenue.yoyGrowth > 0 ? '+' : ''}${deep.revenue.yoyGrowth}%` : '—'}
                    icon={Percent}
                    positive={deep.revenue.yoyGrowth !== null ? deep.revenue.yoyGrowth >= 0 : undefined}
                  />
                </div>
              </div>

              {/* Profit cards */}
              <div>
                <h2 className="text-sm font-semibold text-white mb-3">Profitability (This Year)</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard
                    label="Gross Profit"
                    value={INR(deep.profit.grossProfit)}
                    sub={`${deep.profit.grossMargin}% gross margin`}
                    icon={TrendingUp}
                    positive={deep.profit.grossProfit >= 0}
                  />
                  <StatCard label="Total Expenses" value={INR(deep.profit.expenses)} icon={TrendingDown} />
                  <StatCard
                    label="Net Profit (Est.)"
                    value={INR(deep.profit.netProfit)}
                    sub={`${deep.profit.netMargin}% net margin`}
                    icon={IndianRupee}
                    positive={deep.profit.netProfit >= 0}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">* COGS estimated from product purchase prices. Actual may vary.</p>
              </div>

              {/* Outstanding + invoices */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <h2 className="text-sm font-semibold text-white mb-3">Udhari & Outstanding</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Customers Owe" value={INR(deep.outstanding.totalOwed)} icon={TrendingUp} positive={false} />
                    <StatCard label="Merchant Owes Customers" value={INR(deep.outstanding.totalAdvances)} icon={TrendingDown} />
                    <StatCard label="Supplier Due" value={INR(deep.outstanding.supplierDue)} icon={ShoppingCart} />
                    <StatCard label="Active Customers" value={String(deep.outstanding.activeCustomers)} icon={Users} />
                  </div>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white mb-3">Invoices</h2>
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-2">
                    {[
                      ['Total', deep.invoices.total],
                      ['Paid', deep.invoices.byStatus['paid']?.count ?? 0],
                      ['Unpaid', deep.invoices.byStatus['unpaid']?.count ?? 0],
                      ['Partially Paid', deep.invoices.byStatus['partially_paid']?.count ?? 0],
                      ['Cancelled', deep.invoices.byStatus['cancelled']?.count ?? 0],
                      ['Returned', deep.invoices.byStatus['returned']?.count ?? 0],
                    ].map(([label, count]) => (
                      <div key={String(label)} className="flex justify-between text-sm">
                        <span className="text-gray-400">{label}</span>
                        <span className="text-white font-medium">{String(count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Expenses by category */}
              {deep.expenses.byCategory.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-white mb-3">Expenses by Category (This Year)</h2>
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-2.5">
                    {deep.expenses.byCategory.map((ec) => {
                      const pct = deep.expenses.thisYear > 0
                        ? Math.round(ec.total / deep.expenses.thisYear * 100)
                        : 0;
                      return (
                        <div key={ec._id}>
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span className="capitalize">{ec._id.replace('_', ' ')}</span>
                            <span>{INR(ec.total)} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Monthly revenue chart */}
              {chartData.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-white mb-3">Monthly Revenue (Last 12 Months)</h2>
                  <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}`} />
                        <Tooltip
                          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                          formatter={(val: number | undefined) => [INR(val ?? 0)]}
                        />
                        <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── INVENTORY TAB ── */}
      {tab === 'inventory' && (
        <div className="space-y-5">
          {deepLoading && !deep ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse h-24" />
              ))}
            </div>
          ) : !deep ? (
            <div className="text-gray-500 text-sm p-4">Failed to load inventory data.</div>
          ) : (
            <>
              {/* Inventory summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Products" value={String(deep.inventory.totalProducts)} icon={Package} />
                <StatCard
                  label="Out of Stock"
                  value={String(deep.inventory.outOfStock)}
                  icon={AlertTriangle}
                  positive={deep.inventory.outOfStock === 0}
                />
                <StatCard
                  label="Low Stock"
                  value={String(deep.inventory.lowStock)}
                  icon={AlertTriangle}
                  positive={deep.inventory.lowStock === 0}
                />
                <StatCard
                  label="Inventory Value (Sell)"
                  value={INR(deep.inventory.stockValue)}
                  sub={`Cost: ${INR(deep.inventory.stockCostValue)}`}
                  icon={IndianRupee}
                  positive={true}
                />
              </div>

              {/* Potential margin card */}
              <div className="bg-emerald-900/20 border border-emerald-800 rounded-xl p-4">
                <p className="text-xs text-emerald-400/70 font-medium">Potential Margin on Current Inventory</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{INR(deep.inventory.potentialMargin)}</p>
                <p className="text-xs text-emerald-500/60 mt-0.5">
                  {deep.inventory.stockValue > 0
                    ? `${((deep.inventory.potentialMargin / deep.inventory.stockValue) * 100).toFixed(1)}% margin on selling price`
                    : 'No stock'}
                </p>
              </div>

              {/* Top products table */}
              {deep.inventory.topProducts.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-white mb-3">Top Products by Stock Value</h2>
                  <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800 bg-gray-800/50">
                          <th className="text-left px-4 py-3 text-gray-400 font-medium">Product</th>
                          <th className="text-right px-4 py-3 text-gray-400 font-medium">Stock</th>
                          <th className="text-right px-4 py-3 text-gray-400 font-medium">Sell Price</th>
                          <th className="text-right px-4 py-3 text-gray-400 font-medium">Buy Price</th>
                          <th className="text-right px-4 py-3 text-gray-400 font-medium">Stock Value</th>
                          <th className="text-right px-4 py-3 text-gray-400 font-medium">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deep.inventory.topProducts.map((p, idx) => {
                          const margin = p.purchasePrice
                            ? ((p.sellingPrice - p.purchasePrice) / p.sellingPrice * 100)
                            : null;
                          return (
                            <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                              <td className="px-4 py-3 text-white font-medium">
                                {p.name}
                                <span className="text-xs text-gray-500 ml-1">/ {p.unit}</span>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-300">{p.stock}</td>
                              <td className="px-4 py-3 text-right text-white">{INR(p.sellingPrice)}</td>
                              <td className="px-4 py-3 text-right text-gray-400">{p.purchasePrice ? INR(p.purchasePrice) : '—'}</td>
                              <td className="px-4 py-3 text-right text-emerald-400 font-medium">{INR(p.stockValue)}</td>
                              <td className={`px-4 py-3 text-right text-sm font-medium ${margin !== null ? (margin >= 20 ? 'text-emerald-400' : margin >= 10 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-500'}`}>
                                {margin !== null ? `${margin.toFixed(1)}%` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SUB-LIST TABS (customers/suppliers/transactions/products) ── */}
      {['customers', 'suppliers', 'transactions', 'products'].includes(tab) && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {subLoading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
          ) : subData.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No records found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-800/50">
                    {tab === 'customers' && (
                      <>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Phone</th>
                        <th className="text-right px-4 py-3 text-gray-400 font-medium">Outstanding</th>
                      </>
                    )}
                    {tab === 'suppliers' && (
                      <>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Phone</th>
                        <th className="text-right px-4 py-3 text-gray-400 font-medium">Total Due</th>
                      </>
                    )}
                    {tab === 'transactions' && (
                      <>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Customer</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
                        <th className="text-right px-4 py-3 text-gray-400 font-medium">Amount</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Date</th>
                      </>
                    )}
                    {tab === 'products' && (
                      <>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Product</th>
                        <th className="text-right px-4 py-3 text-gray-400 font-medium">Stock</th>
                        <th className="text-right px-4 py-3 text-gray-400 font-medium">Low Stock At</th>
                        <th className="text-right px-4 py-3 text-gray-400 font-medium">Sell Price</th>
                        <th className="text-right px-4 py-3 text-gray-400 font-medium">Buy Price</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(subData as Record<string, unknown>[]).map((row, idx) => (
                    <tr key={String(row._id ?? idx)} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      {tab === 'customers' && (
                        <>
                          <td className="px-4 py-3 text-white">{String(row.name ?? '—')}</td>
                          <td className="px-4 py-3 text-gray-400">{String(row.phone ?? '—')}</td>
                          <td className={`px-4 py-3 text-right font-medium ${Number(row.totalOutstanding) > 0 ? 'text-red-400' : Number(row.totalOutstanding) < 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {INR(Number(row.totalOutstanding ?? 0))}
                          </td>
                        </>
                      )}
                      {tab === 'suppliers' && (
                        <>
                          <td className="px-4 py-3 text-white">{String(row.name ?? '—')}</td>
                          <td className="px-4 py-3 text-gray-400">{String(row.phone ?? '—')}</td>
                          <td className="px-4 py-3 text-right text-white">{INR(Number(row.totalDue ?? 0))}</td>
                        </>
                      )}
                      {tab === 'transactions' && (
                        <>
                          <td className="px-4 py-3 text-white">{String((row.customerId as Record<string, unknown>)?.name ?? '—')}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.type === 'gave' ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'}`}>
                              {String(row.type)}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${row.type === 'gave' ? 'text-red-400' : 'text-emerald-400'}`}>{INR(Number(row.amount ?? 0))}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{new Date(String(row.createdAt)).toLocaleDateString('en-IN')}</td>
                        </>
                      )}
                      {tab === 'products' && (
                        <>
                          <td className="px-4 py-3">
                            <div className="text-white font-medium">{String(row.name ?? '—')}</div>
                            {row.sku ? <div className="text-xs text-gray-500">{String(row.sku)}</div> : null}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${Number(row.stock) <= 0 ? 'text-red-400' : Number(row.stock) <= Number(row.lowStockThreshold) ? 'text-yellow-400' : 'text-white'}`}>
                            {String(row.stock ?? 0)} {String(row.unit ?? '')}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-400">{String(row.lowStockThreshold ?? 5)}</td>
                          <td className="px-4 py-3 text-right text-white">{INR(Number(row.sellingPrice ?? 0))}</td>
                          <td className="px-4 py-3 text-right text-gray-400">{row.purchasePrice ? INR(Number(row.purchasePrice)) : '—'}</td>
                          <td className="px-4 py-3">
                            {Number(row.stock) <= 0 ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 font-medium">Out of Stock</span>
                            ) : Number(row.stock) <= Number(row.lowStockThreshold) ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 font-medium">Low Stock</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 font-medium">In Stock</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {subTotal > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
              <p className="text-sm text-gray-400">{subTotal} total · Page {subPage}</p>
              <div className="flex gap-2">
                <button onClick={() => setSubPage((p) => Math.max(1, p - 1))} disabled={subPage === 1} className="px-3 py-1 rounded bg-gray-800 text-sm text-gray-400 hover:text-white disabled:opacity-40">Prev</button>
                <button onClick={() => setSubPage((p) => p + 1)} disabled={subData.length < 20} className="px-3 py-1 rounded bg-gray-800 text-sm text-gray-400 hover:text-white disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

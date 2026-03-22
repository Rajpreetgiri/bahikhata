import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, X, ChevronDown, ArrowUpRight, ArrowDownLeft,
  ShoppingCart, Wallet, Users, Truck, Clock,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import api, { getApiErrorMessage } from '../lib/api';
import { HistoryEntry, HistorySummary, Customer, Supplier } from '../types';
import { useCustomerStore } from '../store/customerStore';
import { useSupplierStore } from '../store/supplierStore';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/layout/PageHeader';

type PartyTab = 'all' | 'customer' | 'supplier';
type TxTypeOption = '' | 'gave' | 'got' | 'bought' | 'paid';

interface Filters {
  search: string;
  partyTab: PartyTab;
  partyId: string;
  type: TxTypeOption;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

const defaultFilters: Filters = {
  search: '',
  partyTab: 'all',
  partyId: '',
  type: '',
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
};

function formatGroupDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'd MMMM yyyy');
}

function groupEntriesByDate(entries: HistoryEntry[]): { label: string; items: HistoryEntry[] }[] {
  const groups: Map<string, HistoryEntry[]> = new Map();
  for (const entry of entries) {
    const label = formatGroupDate(entry.createdAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entry);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

const TYPE_COLOR: Record<string, string> = {
  gave:   'text-red-600',
  got:    'text-green-600',
  bought: 'text-orange-600',
  paid:   'text-teal-600',
};

const TYPE_BG: Record<string, string> = {
  gave:   'bg-red-100',
  got:    'bg-green-100',
  bought: 'bg-orange-100',
  paid:   'bg-teal-100',
};

const TYPE_LABEL: Record<string, string> = {
  gave:   'You Gave',
  got:    'You Got',
  bought: 'You Bought',
  paid:   'You Paid',
};

function TxIcon({ type }: { type: string }) {
  const cls = `${TYPE_BG[type]} ${TYPE_COLOR[type]}`;
  const icon = type === 'gave' ? <ArrowUpRight size={16} />
    : type === 'got' ? <ArrowDownLeft size={16} />
    : type === 'bought' ? <ShoppingCart size={16} />
    : <Wallet size={16} />;
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cls}`}>
      {icon}
    </div>
  );
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { customers, loadCustomers } = useCustomerStore();
  const { suppliers, loadSuppliers } = useSupplierStore();

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [summary, setSummary] = useState<HistorySummary>({ totalGave: 0, totalGot: 0, totalBought: 0, totalPaid: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Load party lists for dropdowns
  useEffect(() => {
    loadCustomers();
    loadSuppliers();
  }, []);

  // Debounce search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [filters.search]);

  const buildParams = useCallback(
    (f: Filters, pageNum: number) => {
      const p = new URLSearchParams();
      if (f.partyTab !== 'all') p.set('party', f.partyTab);
      if (f.partyId) p.set('partyId', f.partyId);
      if (f.type) p.set('type', f.type);
      if (debouncedSearch) p.set('search', debouncedSearch);
      if (f.dateFrom) p.set('dateFrom', f.dateFrom);
      if (f.dateTo) p.set('dateTo', f.dateTo);
      if (f.amountMin) p.set('amountMin', f.amountMin);
      if (f.amountMax) p.set('amountMax', f.amountMax);
      p.set('page', String(pageNum));
      p.set('limit', '30');
      return p.toString();
    },
    [debouncedSearch]
  );

  const fetchHistory = useCallback(
    async (f: Filters, pageNum: number, append = false) => {
      if (pageNum === 1) setIsLoading(true);
      else setLoadingMore(true);
      try {
        const qs = buildParams(f, pageNum);
        const res = await api.get<{ data: HistoryEntry[]; meta: { total: number; page: number; pages: number }; summary: HistorySummary }>(
          `/api/history?${qs}`
        );
        const { data, meta, summary: s } = res.data;
        if (append) {
          setEntries((prev) => [...prev, ...data]);
        } else {
          setEntries(data);
        }
        setSummary(s);
        setHasMore(meta.page < meta.pages);
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Failed to load history'));
      } finally {
        setIsLoading(false);
        setLoadingMore(false);
      }
    },
    [buildParams]
  );

  // Re-fetch on filter or debounced search change
  useEffect(() => {
    setPage(1);
    fetchHistory(filters, 1);
  }, [filters.partyTab, filters.partyId, filters.type, filters.dateFrom, filters.dateTo, filters.amountMin, filters.amountMax, debouncedSearch]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchHistory(filters, next, true);
  };

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setDebouncedSearch('');
    setShowFilters(false);
  };

  // Active filter count (excluding partyTab and search)
  const activeFilterCount = [
    filters.partyId,
    filters.type,
    filters.dateFrom,
    filters.dateTo,
    filters.amountMin,
    filters.amountMax,
  ].filter(Boolean).length;

  // Type options depending on active tab
  const typeOptions: { value: TxTypeOption; label: string }[] = filters.partyTab === 'supplier'
    ? [
        { value: '', label: 'All Types' },
        { value: 'bought', label: 'You Bought' },
        { value: 'paid', label: 'You Paid' },
      ]
    : filters.partyTab === 'customer'
    ? [
        { value: '', label: 'All Types' },
        { value: 'gave', label: 'You Gave' },
        { value: 'got', label: 'You Got' },
      ]
    : [
        { value: '', label: 'All Types' },
        { value: 'gave', label: 'You Gave' },
        { value: 'got', label: 'You Got' },
        { value: 'bought', label: 'You Bought' },
        { value: 'paid', label: 'You Paid' },
      ];

  // Party dropdown options
  const partyOptions: { value: string; label: string; kind: 'customer' | 'supplier' }[] = [
    ...(filters.partyTab !== 'supplier'
      ? customers.map((c: Customer) => ({ value: c._id, label: c.name, kind: 'customer' as const }))
      : []),
    ...(filters.partyTab !== 'customer'
      ? suppliers.map((s: Supplier) => ({ value: s._id, label: s.companyName ? `${s.name} (${s.companyName})` : s.name, kind: 'supplier' as const }))
      : []),
  ];

  const grouped = groupEntriesByDate(entries);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader title="Ledger History" />

      {/* Search bar */}
      <div className="bg-white px-4 pb-3 pt-1 border-b border-gray-100">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              placeholder="Search by name or amount..."
              className="input-field pl-10 py-2.5 text-sm"
            />
            {filters.search && (
              <button
                onClick={() => setFilter('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-brand-50 text-brand-600'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Filter size={15} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-brand-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100 px-0">
        {(['all', 'customer', 'supplier'] as PartyTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setFilter('partyTab', tab);
              setFilter('partyId', '');
              // Reset type if incompatible
              if (tab === 'customer' && ['bought', 'paid'].includes(filters.type)) setFilter('type', '');
              if (tab === 'supplier' && ['gave', 'got'].includes(filters.type)) setFilter('type', '');
            }}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors flex items-center justify-center gap-1.5 ${
              filters.partyTab === tab
                ? 'text-brand-500 border-b-2 border-brand-500'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab === 'customer' && <Users size={13} />}
            {tab === 'supplier' && <Truck size={13} />}
            {tab === 'all' ? 'All' : tab === 'customer' ? 'Customers' : 'Suppliers'}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="px-4 pt-3 pb-2">
        {filters.partyTab === 'supplier' ? (
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard label="Total Bought" amount={summary.totalBought} color="orange" />
            <SummaryCard label="Total Paid" amount={summary.totalPaid} color="teal" />
          </div>
        ) : filters.partyTab === 'customer' ? (
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard label="Total Gave" amount={summary.totalGave} color="red" />
            <SummaryCard label="Total Got" amount={summary.totalGot} color="green" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard label="Total Gave" amount={summary.totalGave} color="red" />
            <SummaryCard label="Total Got" amount={summary.totalGot} color="green" />
            <SummaryCard label="Total Bought" amount={summary.totalBought} color="orange" />
            <SummaryCard label="Total Paid" amount={summary.totalPaid} color="teal" />
          </div>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-100 px-4 py-4 space-y-3">
          {/* Row 1: Type + Party */}
          <div className="grid grid-cols-2 gap-2">
            {/* Type select */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <div className="relative">
                <select
                  value={filters.type}
                  onChange={(e) => setFilter('type', e.target.value as TxTypeOption)}
                  className="input-field text-sm appearance-none pr-8"
                >
                  {typeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Party select */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {filters.partyTab === 'supplier' ? 'Supplier' : 'Customer'}
              </label>
              <div className="relative">
                <select
                  value={filters.partyId}
                  onChange={(e) => setFilter('partyId', e.target.value)}
                  className="input-field text-sm appearance-none pr-8"
                >
                  <option value="">All</option>
                  {partyOptions.map((o) => (
                    <option key={`${o.kind}-${o.value}`} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 2: Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilter('dateFrom', e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilter('dateTo', e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>

          {/* Row 3: Amount range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min Amount (₹)</label>
              <input
                type="number"
                value={filters.amountMin}
                onChange={(e) => setFilter('amountMin', e.target.value)}
                placeholder="0"
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Amount (₹)</label>
              <input
                type="number"
                value={filters.amountMax}
                onChange={(e) => setFilter('amountMax', e.target.value)}
                placeholder="∞"
                className="input-field text-sm"
              />
            </div>
          </div>

          {/* Active chips + clear */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {filters.dateFrom && (
              <FilterChip label={`From: ${filters.dateFrom}`} onRemove={() => setFilter('dateFrom', '')} />
            )}
            {filters.dateTo && (
              <FilterChip label={`To: ${filters.dateTo}`} onRemove={() => setFilter('dateTo', '')} />
            )}
            {filters.type && (
              <FilterChip label={TYPE_LABEL[filters.type]} onRemove={() => setFilter('type', '')} />
            )}
            {filters.partyId && (
              <FilterChip
                label={partyOptions.find((o) => o.value === filters.partyId)?.label ?? 'Party'}
                onRemove={() => setFilter('partyId', '')}
              />
            )}
            {filters.amountMin && (
              <FilterChip label={`≥ ₹${filters.amountMin}`} onRemove={() => setFilter('amountMin', '')} />
            )}
            {filters.amountMax && (
              <FilterChip label={`≤ ₹${filters.amountMax}`} onRemove={() => setFilter('amountMax', '')} />
            )}
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-red-500 font-medium ml-auto">
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No transactions found"
            description={activeFilterCount > 0 || filters.search ? 'Try adjusting your filters' : 'Transactions will appear here once recorded'}
          />
        ) : (
          <>
            {grouped.map(({ label, items }) => (
              <div key={label}>
                {/* Date group header */}
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                </div>
                {/* Entries */}
                {items.map((entry) => (
                  <button
                    key={entry._id}
                    onClick={() => navigate(entry.partyKind === 'customer' ? `/customers/${entry.party._id}` : `/suppliers/${entry.party._id}`)}
                    className="w-full flex items-center gap-3 bg-white px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                  >
                    {/* Transaction type icon */}
                    <TxIcon type={entry.type} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {/* Party kind badge */}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                          entry.partyKind === 'customer'
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-purple-100 text-purple-600'
                        }`}>
                          {entry.partyKind === 'customer' ? 'C' : 'S'}
                        </span>
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {entry.party.companyName
                            ? `${entry.party.name} • ${entry.party.companyName}`
                            : entry.party.name}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {entry.note ?? TYPE_LABEL[entry.type]}
                      </p>
                    </div>

                    {/* Amount + time */}
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold text-sm ${TYPE_COLOR[entry.type]}`}>
                        ₹{entry.amount.toLocaleString('en-IN')}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {format(new Date(entry.createdAt), 'h:mm a')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="py-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-sm font-medium text-brand-600 bg-brand-50 px-5 py-2.5 rounded-xl hover:bg-brand-100 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const SUMMARY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  red:    { bg: 'bg-red-50',    text: 'text-red-600',    label: 'text-red-400' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  label: 'text-green-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', label: 'text-orange-400' },
  teal:   { bg: 'bg-teal-50',   text: 'text-teal-600',   label: 'text-teal-500' },
};

function SummaryCard({ label, amount, color }: { label: string; amount: number; color: string }) {
  const c = SUMMARY_COLORS[color];
  return (
    <div className={`${c.bg} rounded-2xl px-3 py-2.5`}>
      <p className={`text-xs font-medium ${c.label}`}>{label}</p>
      <p className={`text-base font-bold mt-0.5 ${c.text}`}>
        ₹{amount.toLocaleString('en-IN')}
      </p>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 bg-brand-50 text-brand-700 text-xs font-medium px-2.5 py-1 rounded-full">
      {label}
      <button onClick={onRemove} className="text-brand-400 hover:text-brand-700 ml-0.5">
        <X size={11} />
      </button>
    </span>
  );
}

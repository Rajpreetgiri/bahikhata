import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Filter, X } from 'lucide-react';
import { useInvoiceStore } from '../store/invoiceStore';
import { useCustomerStore } from '../store/customerStore';
import { InvoiceStatus } from '../types';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import InvoiceCard from '../components/features/InvoiceCard';
import PageHeader from '../components/layout/PageHeader';

const TABS: { label: string; value: InvoiceStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unpaid', value: 'unpaid' },
  { label: 'Partial', value: 'partially_paid' },
  { label: 'Paid', value: 'paid' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Returned', value: 'returned' },
];

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { invoices, meta, isLoading, loadInvoices } = useInvoiceStore();
  const { customers, loadCustomers } = useCustomerStore();

  const [activeTab, setActiveTab] = useState<InvoiceStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]);

  const reload = useCallback(() => {
    // page omitted → defaults to 1 → replaces list
    loadInvoices({
      status: activeTab === 'all' ? undefined : activeTab,
      search: debouncedSearch || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }, [activeTab, debouncedSearch, dateFrom, dateTo]);

  useEffect(() => {
    reload();
    loadCustomers();
  }, [activeTab, debouncedSearch, dateFrom, dateTo]);

  const customerMap = new Map(customers.map((c) => [c._id, c.name]));

  const unpaidCount = invoices.filter((inv) => inv.status === 'unpaid').length;
  const partialCount = invoices.filter((inv) => inv.status === 'partially_paid').length;

  const activeFilterCount = [debouncedSearch, dateFrom, dateTo].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setShowFilters(false);
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Invoices"
        action={{ label: 'New', icon: Plus, onClick: () => navigate('/invoices/create') }}
      />

      {/* Search + filter bar */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 pt-3 pb-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice # or customer..."
              className="input-field pl-10 py-2 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-600'
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

        {/* Date filter panel */}
        {showFilters && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field text-sm" />
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={clearFilters} className="text-xs text-red-500 font-medium">Clear filters</button>
            )}
          </div>
        )}
      </div>

      {/* Status tabs */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${activeTab === tab.value ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
            >
              {tab.label}
              {tab.value === 'unpaid' && unpaidCount > 0 && (
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'unpaid' ? 'bg-white/20' : 'bg-orange-100 text-orange-600'}`}>
                  {unpaidCount}
                </span>
              )}
              {tab.value === 'partially_paid' && partialCount > 0 && (
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'partially_paid' ? 'bg-white/20' : 'bg-amber-100 text-amber-600'}`}>
                  {partialCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices found"
            description={activeFilterCount > 0 || search ? 'Try adjusting your search or filters' : 'Create your first invoice'}
            action={
              !activeFilterCount && !search ? (
                <button onClick={() => navigate('/invoices/create')} className="btn-primary max-w-xs">
                  New Invoice
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5 bg-gray-50">
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </p>
            {invoices.map((inv) => {
              const customerId = typeof inv.customerId === 'string' ? inv.customerId : inv.customerId._id;
              return (
                <InvoiceCard
                  key={inv._id}
                  invoice={inv}
                  customerName={customerMap.get(customerId)}
                  onClick={() => navigate(`/invoices/${inv._id}`)}
                />
              );
            })}
            {meta.page < meta.pages && (
              <button
                onClick={() =>
                  loadInvoices({
                    status: activeTab === 'all' ? undefined : activeTab,
                    search: debouncedSearch || undefined,
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
                    page: meta.page + 1,
                  })
                }
                disabled={isLoading}
                className="w-full py-4 text-sm text-brand-500 font-medium disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

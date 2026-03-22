import { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Users, ArrowDownUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../lib/api';
import { useCustomerStore } from '../store/customerStore';
import CustomerCard from '../components/features/CustomerCard';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/layout/PageHeader';

type SortKey = 'outstanding_desc' | 'outstanding_asc' | 'name_asc' | 'name_desc' | 'recent';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'outstanding_desc', label: 'Highest Udhari' },
  { key: 'outstanding_asc', label: 'Lowest Udhari' },
  { key: 'name_asc', label: 'Name A-Z' },
  { key: 'name_desc', label: 'Name Z-A' },
  { key: 'recent', label: 'Recent Activity' },
];

export default function CustomersPage() {
  const { customers, loadCustomers, addCustomer, isLoading } = useCustomerStore();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('outstanding_desc');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadCustomers(); }, []);

  const filtered = useMemo(() => {
    let list = customers.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
    );
    switch (sort) {
      case 'outstanding_desc': list = [...list].sort((a, b) => b.totalOutstanding - a.totalOutstanding); break;
      case 'outstanding_asc': list = [...list].sort((a, b) => a.totalOutstanding - b.totalOutstanding); break;
      case 'name_asc': list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name_desc': list = [...list].sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'recent': list = [...list].sort((a, b) => new Date(b.lastTransactionAt ?? 0).getTime() - new Date(a.lastTransactionAt ?? 0).getTime()); break;
    }
    return list;
  }, [customers, search, sort]);

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setAdding(true);
    try {
      await addCustomer(form);
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '' });
      toast.success('Customer added!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to add customer'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Customers"
        action={{ label: 'Add', icon: Plus, onClick: () => setShowAdd(true) }}
      />
      <div className="bg-white px-4 md:px-6 pb-3 pt-3 border-b border-gray-100 space-y-2.5">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="input-field pl-10 py-2.5 text-sm"
          />
        </div>
        {/* Sort chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none">
          <ArrowDownUp size={14} className="text-gray-400 flex-shrink-0 mt-1.5" />
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                sort === opt.key
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : filtered.length === 0 ? (
          search ? (
            <EmptyState icon={Search} title="No results" description={`No customer matching "${search}"`} />
          ) : (
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="Add your first customer to start tracking"
              action={
                <button onClick={() => setShowAdd(true)} className="btn-primary max-w-xs">
                  Add Customer
                </button>
              }
            />
          )
        ) : (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5 bg-gray-50">
              {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
            </p>
            {filtered.map((c) => <CustomerCard key={c._id} customer={c} />)}
          </>
        )}
      </div>

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Customer">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer name" className="input-field" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} type="tel" placeholder="9876543210" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="customer@email.com" className="input-field" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAdd} disabled={adding} className="btn-primary">{adding ? 'Adding...' : 'Add'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Truck, ArrowDownUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../lib/api';
import { useSupplierStore } from '../store/supplierStore';
import SupplierCard from '../components/features/SupplierCard';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/layout/PageHeader';

type SupplierSortKey = 'due_desc' | 'due_asc' | 'name_asc' | 'recent';

const SORT_OPTIONS: { key: SupplierSortKey; label: string }[] = [
  { key: 'due_desc', label: 'Highest Due' },
  { key: 'due_asc', label: 'Lowest Due' },
  { key: 'name_asc', label: 'Name A-Z' },
  { key: 'recent', label: 'Recent Activity' },
];

export default function SuppliersPage() {
  const { suppliers, loadSuppliers, addSupplier, isLoading } = useSupplierStore();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SupplierSortKey>('due_desc');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', companyName: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadSuppliers(); }, []);

  const filtered = useMemo(() => {
    let list = suppliers.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.companyName?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search)
    );
    switch (sort) {
      case 'due_desc': list = [...list].sort((a, b) => b.totalDue - a.totalDue); break;
      case 'due_asc': list = [...list].sort((a, b) => a.totalDue - b.totalDue); break;
      case 'name_asc': list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'recent': list = [...list].sort((a, b) => new Date(b.lastTransactionAt ?? 0).getTime() - new Date(a.lastTransactionAt ?? 0).getTime()); break;
    }
    return list;
  }, [suppliers, search, sort]);

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setAdding(true);
    try {
      await addSupplier({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
      });
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '', companyName: '' });
      toast.success('Supplier added!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to add supplier'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Suppliers"
        action={{ label: 'Add', icon: Plus, onClick: () => setShowAdd(true) }}
      />
      <div className="bg-white px-4 md:px-6 pb-3 pt-3 border-b border-gray-100 space-y-2.5">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers..."
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

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : filtered.length === 0 ? (
          search ? (
            <EmptyState icon={Search} title="No results" description={`No supplier matching "${search}"`} />
          ) : (
            <EmptyState
              icon={Truck}
              title="No suppliers yet"
              description="Add vendors & wholesalers to track what you owe them"
              action={
                <button onClick={() => setShowAdd(true)} className="btn-primary max-w-xs">
                  Add Supplier
                </button>
              }
            />
          )
        ) : (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5 bg-gray-50">
              {filtered.length} supplier{filtered.length !== 1 ? 's' : ''}
            </p>
            {filtered.map((s) => <SupplierCard key={s._id} supplier={s} />)}
          </>
        )}
      </div>

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Supplier">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Owner / contact name"
              className="input-field"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company / Firm Name</label>
            <input
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              placeholder="e.g. Sharma Traders, Raj Distributors"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              type="tel"
              placeholder="9876543210"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              type="email"
              placeholder="supplier@email.com"
              className="input-field"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAdd} disabled={adding} className="btn-primary">
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

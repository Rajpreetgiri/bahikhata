import { useEffect, useState } from 'react';
import {
  Plus, Trash2, Pencil, Filter, X, ChevronDown, TrendingDown,
  Building2, Users, Zap, Package, Truck, Megaphone, Wrench, MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../lib/api';
import { useExpenseStore } from '../store/expenseStore';
import { EXPENSE_CATEGORIES, Expense, ExpenseCategory } from '../types';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank' },
  { value: 'other', label: 'Other' },
];

const EXPENSE_ICONS: Record<string, LucideIcon> = {
  Building2, Users, Zap, Package, Truck, Megaphone, Wrench, MoreHorizontal,
};

function categoryLabel(cat: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}
function CategoryIcon({ cat, size = 18, className = '' }: { cat: string; size?: number; className?: string }) {
  const iconName = EXPENSE_CATEGORIES.find((c) => c.value === cat)?.iconName ?? 'MoreHorizontal';
  const Icon = EXPENSE_ICONS[iconName] ?? MoreHorizontal;
  return <Icon size={size} className={className} />;
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const today = toLocalDateString(new Date());
const monthStart = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

interface FormState {
  amount: string;
  category: ExpenseCategory;
  note: string;
  paymentMethod: string;
  date: string;
}

const defaultForm: FormState = {
  amount: '',
  category: 'other',
  note: '',
  paymentMethod: '',
  date: today,
};

export default function ExpensesPage() {
  const { expenses, meta, summary, isLoading, loadExpenses, loadSummary, addExpense, updateExpense, deleteExpense } =
    useExpenseStore();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Delete confirm
  const [toDelete, setToDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Summary accordion
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    loadExpenses({ category: filterCategory, dateFrom: filterDateFrom, dateTo: filterDateTo });
    loadSummary(filterDateFrom || monthStart, filterDateTo || today);
  }, []);

  const applyFilters = () => {
    loadExpenses({ category: filterCategory, dateFrom: filterDateFrom, dateTo: filterDateTo });
    loadSummary(filterDateFrom || monthStart, filterDateTo || today);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilterCategory('');
    setFilterDateFrom('');
    setFilterDateTo('');
    loadExpenses({});
    loadSummary(monthStart, today);
  };

  const hasFilters = !!(filterCategory || filterDateFrom || filterDateTo);

  const openAdd = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({
      amount: String(expense.amount),
      category: expense.category,
      note: expense.note ?? '',
      paymentMethod: expense.paymentMethod ?? '',
      date: expense.date.slice(0, 10),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) { toast.error('Enter valid amount'); return; }
    if (!form.date) { toast.error('Select date'); return; }

    setSaving(true);
    try {
      const payload = {
        amount: amt,
        category: form.category,
        note: form.note || undefined,
        paymentMethod: form.paymentMethod || undefined,
        date: form.date,
      };

      if (editing) {
        await updateExpense(editing._id, payload);
        toast.success('Expense updated!');
      } else {
        await addExpense(payload);
        toast.success('Expense added!');
      }

      setShowForm(false);
      loadSummary(filterDateFrom || monthStart, filterDateTo || today);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save expense'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteExpense(toDelete._id);
      toast.success('Expense deleted');
      setToDelete(null);
      loadSummary(filterDateFrom || monthStart, filterDateTo || today);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete'));
    } finally {
      setDeleting(false);
    }
  };

  // Group expenses by date
  const grouped: Record<string, Expense[]> = {};
  expenses.forEach((e) => {
    const d = e.date.slice(0, 10);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(e);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 md:pt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Expenses</h1>
            <p className="text-xs text-gray-400">Dukaan ka kharch track karo</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-brand-500 text-white font-semibold text-sm px-3 py-2 rounded-xl"
          >
            <Plus size={16} />
            Add
          </button>
        </div>

        {/* Summary Card */}
        {summary && (
          <button
            onClick={() => setShowSummary((v) => !v)}
            className="w-full bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-left mb-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-400 font-medium">
                  {filterDateFrom || filterDateTo ? 'Period Expenses' : 'This Month'}
                </p>
                <p className="text-xl font-bold text-red-600">
                  ₹{summary.grandTotal.toLocaleString('en-IN')}
                </p>
              </div>
              <ChevronDown
                size={18}
                className={`text-red-400 transition-transform ${showSummary ? 'rotate-180' : ''}`}
              />
            </div>

            {showSummary && (
              <div className="mt-3 space-y-1.5 border-t border-red-100 pt-3">
                {summary.categories.map((cat) => (
                  <div key={cat._id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <CategoryIcon cat={cat._id} size={14} className="text-gray-500" />
                      {categoryLabel(cat._id)}
                      <span className="text-gray-400 text-xs">({cat.count})</span>
                    </span>
                    <span className="font-semibold text-gray-800">₹{cat.total.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                {summary.categories.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-1">No expenses in this period</p>
                )}
              </div>
            )}
          </button>
        )}

        {/* Filter bar */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(true)}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl border transition-colors ${hasFilters
                ? 'bg-brand-50 text-brand-600 border-brand-200'
                : 'bg-white text-gray-500 border-gray-200'
              }`}
          >
            <Filter size={14} />
            Filter {hasFilters && '(on)'}
          </button>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-gray-400 px-2 py-1.5"
            >
              <X size={13} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size={32} />
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={TrendingDown}
            title="No expenses yet"
            description="Add your first expense to start tracking"
            action={
              <button onClick={openAdd} className="btn-primary max-w-xs">
                Add Expense
              </button>
            }
          />
        ) : (
          <>
            {sortedDates.map((date) => (
              <div key={date}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 border-b border-gray-100">
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
                {grouped[date].map((e) => (
                  <div
                    key={e._id}
                    className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-50"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                      <CategoryIcon cat={e.category} size={20} className="text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{categoryLabel(e.category)}</p>
                      {e.note && <p className="text-xs text-gray-400 truncate">{e.note}</p>}
                      {e.paymentMethod && (
                        <p className="text-xs text-gray-400">{e.paymentMethod.replace('_', ' ')}</p>
                      )}
                    </div>
                    <div className="text-right mr-1">
                      <p className="font-bold text-red-600">₹{e.amount.toLocaleString('en-IN')}</p>
                    </div>
                    <button onClick={() => openEdit(e)} className="text-gray-400 p-1.5 hover:text-brand-500">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setToDelete(e)} className="text-gray-400 p-1.5 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
            {meta.page < meta.pages && (
              <button
                onClick={() =>
                  loadExpenses({
                    category: filterCategory,
                    dateFrom: filterDateFrom,
                    dateTo: filterDateTo,
                    page: meta.page + 1,
                  })
                }
                className="w-full py-4 text-sm text-brand-500 font-medium"
              >
                Load More
              </button>
            )}
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Expense' : 'Add Expense'}
      >
        <div className="space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹) *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-lg">₹</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="input-field pl-9 text-2xl font-bold"
                autoFocus
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
            <div className="flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setForm({ ...form, category: cat.value })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${form.category === cat.value
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300'
                    }`}
                >
                  <CategoryIcon cat={cat.value} size={13} />
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
            <input
              type="date"
              value={form.date}
              max={today}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input-field"
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Method (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm({ ...form, paymentMethod: form.paymentMethod === m.value ? '' : m.value })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${form.paymentMethod === m.value
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300'
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. March rent, Ramesh salary..."
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="input-field"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? 'Saving...' : editing ? 'Update' : 'Add Expense'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete Expense?">
        {toDelete && (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              <strong>₹{toDelete.amount.toLocaleString('en-IN')}</strong> — {categoryLabel(toDelete.category)}{' '}
              {toDelete.note ? `(${toDelete.note})` : ''}
            </p>
            <p className="text-gray-400 text-xs">Yeh action undo nahi ho sakta.</p>
            <div className="flex gap-3">
              <button onClick={() => setToDelete(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Filter Modal */}
      <Modal open={showFilters} onClose={() => setShowFilters(false)} title="Filter Expenses">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="input-field"
            >
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">From</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">To</label>
              <input
                type="date"
                value={filterDateTo}
                max={today}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowFilters(false)} className="btn-secondary">Cancel</button>
            <button onClick={applyFilters} className="btn-primary flex-1">Apply Filters</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

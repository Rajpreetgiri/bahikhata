import { useEffect, useState } from 'react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight, Plus, Trash2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../lib/api';
import { useCashbookStore } from '../store/cashbookStore';
import { CashEntry } from '../types';
import PageHeader from '../components/layout/PageHeader';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';

const QUICK_RANGES = [
  { label: 'Today', days: 0 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
];

function groupByDate(entries: CashEntry[]): Record<string, CashEntry[]> {
  return entries.reduce<Record<string, CashEntry[]>>((acc, e) => {
    const key = format(new Date(e.date), 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});
}

export default function CashbookPage() {
  const { entries, summary, isLoading, hasMore, loadEntries, loadSummary, addEntry, deleteEntry } = useCashbookStore();

  const [rangeIdx, setRangeIdx] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'in' | 'out'>('in');
  const [addForm, setAddForm] = useState({ amount: '', note: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<CashEntry | null>(null);

  const getDateRange = (days: number) => {
    const to = endOfDay(new Date());
    const from = days === 0 ? startOfDay(new Date()) : startOfDay(subDays(new Date(), days));
    return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
  };

  const reload = (idx = rangeIdx) => {
    const range = QUICK_RANGES[idx];
    const params = getDateRange(range.days);
    loadEntries({ ...params, reset: true });
    loadSummary(params);
  };

  useEffect(() => { reload(0); }, []);

  const handleRangeChange = (idx: number) => {
    setRangeIdx(idx);
    reload(idx);
  };

  const handleAdd = async () => {
    const amount = parseFloat(addForm.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (!addForm.date) { toast.error('Select a date'); return; }
    setSaving(true);
    try {
      await addEntry({ type: addType, amount, note: addForm.note || undefined, date: new Date(addForm.date).toISOString() });
      toast.success(`Cash ${addType === 'in' ? 'In' : 'Out'} recorded`);
      setShowAddModal(false);
      setAddForm({ amount: '', note: '', date: format(new Date(), 'yyyy-MM-dd') });
      reload();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: CashEntry) => {
    try {
      await deleteEntry(entry._id);
      toast.success('Entry deleted');
      setToDelete(null);
      reload();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete'));
    }
  };

  const grouped = groupByDate(entries);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Cashbook" />

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Date range tabs */}
        <div className="flex gap-2 px-4 pt-4">
          {QUICK_RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => handleRangeChange(i)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                rangeIdx === i ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-3 gap-3 px-4 pt-4">
            <div className="bg-green-50 rounded-2xl p-3 text-center">
              <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">Cash In</p>
              <p className="text-lg font-bold text-green-600 mt-1">₹{summary.totalIn.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-red-50 rounded-2xl p-3 text-center">
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">Cash Out</p>
              <p className="text-lg font-bold text-red-500 mt-1">₹{summary.totalOut.toLocaleString('en-IN')}</p>
            </div>
            <div className={`rounded-2xl p-3 text-center ${summary.netCash >= 0 ? 'bg-brand-50' : 'bg-orange-50'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${summary.netCash >= 0 ? 'text-brand-600' : 'text-orange-600'}`}>Net</p>
              <p className={`text-lg font-bold mt-1 ${summary.netCash >= 0 ? 'text-brand-600' : 'text-orange-600'}`}>
                ₹{Math.abs(summary.netCash).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        )}

        {/* Entries */}
        <div className="mt-4">
          {isLoading && entries.length === 0 ? (
            <div className="flex justify-center py-12"><Spinner size={32} /></div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No entries yet</p>
              <p className="text-xs mt-1">Add cash in/out entries to track daily cash flow</p>
            </div>
          ) : (
            sortedDates.map((dateKey) => (
              <div key={dateKey}>
                <div className="px-4 py-2 bg-gray-50 border-y border-gray-100">
                  <p className="text-xs font-semibold text-gray-500">
                    {format(new Date(dateKey), 'd MMMM yyyy')}
                  </p>
                </div>
                {grouped[dateKey].map((entry) => (
                  <div key={entry._id} className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-gray-50">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${entry.type === 'in' ? 'bg-green-100' : 'bg-red-100'}`}>
                      {entry.type === 'in'
                        ? <ArrowDownLeft size={16} className="text-green-500" />
                        : <ArrowUpRight size={16} className="text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${entry.type === 'in' ? 'text-green-600' : 'text-red-500'}`}>
                        {entry.type === 'in' ? '+ ' : '− '}₹{entry.amount.toLocaleString('en-IN')}
                      </p>
                      {entry.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{entry.note}</p>}
                    </div>
                    <button onClick={() => setToDelete(entry)} className="text-gray-200 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {hasMore && (
          <div className="py-4 flex justify-center">
            <button
              onClick={() => loadEntries({ reset: false })}
              disabled={isLoading}
              className="flex items-center gap-2 text-sm text-brand-600 font-semibold px-4 py-2 rounded-xl hover:bg-brand-50 disabled:opacity-50"
            >
              <ChevronDown size={16} />
              Load More
            </button>
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 md:bottom-8 md:right-8 flex flex-col gap-2 items-end">
        <button
          onClick={() => { setAddType('out'); setShowAddModal(true); }}
          className="flex items-center gap-2 bg-red-500 text-white font-semibold text-sm px-4 py-2.5 rounded-2xl shadow-lg"
        >
          <ArrowUpRight size={16} />
          Cash Out
        </button>
        <button
          onClick={() => { setAddType('in'); setShowAddModal(true); }}
          className="flex items-center gap-2 bg-green-500 text-white font-semibold text-sm px-4 py-2.5 rounded-2xl shadow-lg"
        >
          <ArrowDownLeft size={16} />
          Cash In
        </button>
      </div>

      {/* Add Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Record Cash Entry">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setAddType('in')}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm ${addType === 'in' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-600'}`}
            >
              Cash In
            </button>
            <button
              onClick={() => setAddType('out')}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm ${addType === 'out' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500'}`}
            >
              Cash Out
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={addForm.amount}
                onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
                className="input-field pl-9 font-bold"
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <input
              type="date"
              value={addForm.date}
              onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. milk sale, rent payment..."
              value={addForm.note}
              onChange={(e) => setAddForm({ ...addForm, note: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className={`flex-1 py-3 rounded-xl font-semibold text-white ${addType === 'in' ? 'bg-green-500' : 'bg-red-500'}`}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete Entry?">
        <p className="text-gray-500 text-sm mb-5">
          Delete ₹{toDelete?.amount.toLocaleString('en-IN')} {toDelete?.type === 'in' ? 'cash in' : 'cash out'} entry?
        </p>
        <div className="flex gap-3">
          <button onClick={() => setToDelete(null)} className="btn-secondary">Cancel</button>
          <button onClick={() => toDelete && handleDelete(toDelete)} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold">
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
